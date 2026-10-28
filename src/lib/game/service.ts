import "server-only";
import { randomInt } from "node:crypto";
import { after } from "next/server";
import { Prisma, type Game, type Participant, type Player, type Round, type TeamMember } from "@/generated/prisma/client";
import { ownerData, ownerWhere, type Owner } from "@/lib/access/owner";
import { ownerKindOf, recordEvent, recordGameEvent } from "@/lib/analytics/events";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { withPlaces } from "./standings";
import { fakeItunesSource } from "@/lib/itunes/fake";
import { cachedSearch } from "@/lib/itunes/cache";
import { startPlayback } from "@/lib/spotify/playback";
import {
  getPlaylistTracks,
  searchTracks,
  SEARCH_MAX_OFFSET,
  SEARCH_PAGE_SIZE,
  PLAYLIST_PAGE_SIZE,
} from "@/lib/spotify/sources";
import { emit } from "./events";
import { createGameSchema, gameFiltersSchema, type CreateGameInput, type GameFilters, type GameMode, type TeamInput } from "./filters";
import { isCorrectArtist, isCorrectGuess } from "./matcher";
import { pickOpenTrack, type OpenTrackSource } from "./open-picker";
import type { GameFormat } from "./teams";
import {
  ARTIST_POINTS,
  artistAvailable,
  elapsedMs,
  pointsForElapsed,
  rulesFor,
  unlockedHints,
  type RoundClock,
} from "./scoring";
import { pickTrack, type PickedTrack, type TrackSource } from "./track-picker";

export type GameStatus = "LOBBY" | "PLAYING" | "FINISHED";
export type RoundStatus = "PLAYING" | "WON" | "REVEALED";

/** Canciones de Spotify con la cuenta del usuario `userId`. */
export function spotifySourceFor(userId: string): TrackSource {
  return {
    search: (p) => searchTracks(userId, p),
    playlist: ({ playlistId, ...rest }) => getPlaylistTracks(userId, playlistId, rest),
  };
}

// Las pruebas e2e usan canciones inventadas (E2E_FAKE_ITUNES=1, nunca definida en Vercel); la real pasa por la caché.
export const itunesSource: OpenTrackSource =
  process.env.E2E_FAKE_ITUNES === "1" ? fakeItunesSource : { search: (p) => cachedSearch(p) };

// ---------- Vistas públicas (lo que devuelve la API) ----------

function roundClock(round: Round): RoundClock {
  return {
    playStartedAt: round.playStartedAt,
    pausedAt: round.pausedAt,
    pausedMs: round.pausedMs,
    trackName: round.trackName,
    artists: JSON.parse(round.artists) as string[],
    genre: round.genre,
  };
}

/** La partida a la que pertenece la ronda: su modo fija las reglas y su fragmento, la duración. */
type RoundGame = Pick<Game, "fragmentSeconds" | "mode" | "answerSeconds">;

/** Nombres de quienes se unieron desde el móvil, por id (para decir quién tiene el turno). */
type ParticipantNames = ReadonlyMap<string, { name: string; playerId: string }>;

export function toPublicRound(round: Round, game: RoundGame, now = new Date(), people?: ParticipantNames) {
  const closed = round.status !== "PLAYING";
  const rules = rulesFor(game.mode);
  const clock = roundClock(round);
  const elapsed = elapsedMs(clock, now);
  const { hints, nextHintAt } = unlockedHints(clock, now, closed, rules);
  return {
    id: round.id,
    number: round.number,
    status: round.status as RoundStatus,
    startMs: round.startMs,
    fragmentMs: game.fragmentSeconds * 1000,
    /** `null` hasta que suena por primera vez. */
    playStartedAt: round.playStartedAt,
    /** El anfitrión pausó: el reloj de puntos y pistas está parado. */
    paused: !!round.pausedAt,
    elapsedMs: elapsed,
    /** Lo que vale acertar el título ahora mismo (null si la ronda está cerrada). */
    pointsNow: closed ? null : pointsForElapsed(elapsed, rules),
    artistAvailable: !closed && !round.artistWinnerPlayerId && artistAvailable(clock, now, rules),
    hints,
    nextHintAt: closed ? null : nextHintAt,
    winnerPlayerId: round.winnerPlayerId,
    artistWinnerPlayerId: round.artistWinnerPlayerId,
    /** Quien pulsó «¡Lo sé!» y está respondiendo (el reloj de la ronda está parado). */
    buzz:
      !closed && round.buzzParticipantId && round.buzzDeadline
        ? {
            participantId: round.buzzParticipantId,
            name: people?.get(round.buzzParticipantId)?.name ?? "",
            playerId: people?.get(round.buzzParticipantId)?.playerId ?? "",
            /** Lo que le queda para responder, medido por el servidor (no depende del reloj del móvil). */
            remainingMs: Math.max(0, round.buzzDeadline.getTime() - now.getTime()),
            totalMs: game.answerSeconds * 1000,
          }
        : null,
    // La respuesta solo se desvela cuando la ronda está cerrada.
    answer: closed
      ? {
          trackId: round.trackId,
          name: round.trackName,
          artists: clock.artists,
          genre: round.genre,
          albumImage: round.albumImage,
          uri: round.trackUri,
        }
      : null,
  };
}

export type PublicRound = ReturnType<typeof toPublicRound>;

type PlayerWithMembers = Player & { members: TeamMember[] };

/** Jugadores (o equipos) de más a menos puntos. En equipos llevan su color y sus miembros. */
function toPublicPlayers(players: PlayerWithMembers[]) {
  return [...players]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      /** Color del equipo (clave de la paleta); null en todos contra todos. */
      color: p.color,
      /** Quiénes forman el equipo, en orden de llegada; vacío en todos contra todos. */
      members: [...p.members].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).map((m) => m.name),
    }));
}

function toPublicGame(
  game: Game & { players: PlayerWithMembers[]; rounds: Round[]; participants?: Participant[] },
  catalogNumber: number,
) {
  const now = new Date();
  const people: ParticipantNames = new Map((game.participants ?? []).map((p) => [p.id, { name: p.name, playerId: p.playerId }]));
  const current = game.rounds.find((r) => r.number === game.currentRound) ?? null;
  return {
    id: game.id,
    code: game.code,
    /** Número correlativo de la partida (la primera es la 1), para mostrarla como "C-014". */
    catalogNumber,
    createdAt: game.createdAt,
    /** "spotify" (canción completa) o "open" (vista previa de 30 s, sin cuenta). */
    mode: game.mode as GameMode,
    status: game.status as GameStatus,
    totalRounds: game.totalRounds,
    currentRound: game.currentRound,
    fragmentSeconds: game.fragmentSeconds,
    /** "solo" (todos contra todos) o "teams" (cada entrada de `players` es un equipo). */
    format: game.format as GameFormat,
    maxTeamSize: game.maxTeamSize,
    /** Si se puede entrar con el código desde el móvil. */
    joinOpen: game.joinOpen,
    /** Segundos que tiene quien pulsa «¡Lo sé!» para responder. */
    answerSeconds: game.answerSeconds,
    /** Al fallar queda fuera "person" (solo quien falló) o "team" (todo su equipo). */
    lockout: game.lockout as "person" | "team",
    filters: JSON.parse(game.filters) as GameFilters,
    /** La partida creada con «Otra igual» al terminar esta (los móviles unidos pasan a ella solos). */
    nextGameId: game.nextGameId,
    /** Si la siguiente canción ya está elegida (la próxima ronda empezará sin espera). */
    nextTrackReady: !!game.nextTrack && game.nextTrackFilters === game.filters,
    players: toPublicPlayers(game.players),
    round: current ? toPublicRound(current, game, now, people) : null,
    history: game.rounds
      .filter((r) => r.status !== "PLAYING")
      .sort((a, b) => a.number - b.number)
      .map((r) => toPublicRound(r, game, now, people)),
  };
}

export type PublicGame = ReturnType<typeof toPublicGame>;

// ---------- Helpers ----------

/** Mismo tope que al crear la partida (`createGameSchema`). */
const MAX_PLAYERS = 20;

const CODE_ALPHABET ="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I

function generateCode(length = 6) {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Mismo dueño que la partida (cada estantería numera sus casetes desde el 1). */
function sameOwner(game: Pick<Game, "userId" | "guestId">) {
  return game.userId ? { userId: game.userId } : { guestId: game.guestId };
}

async function catalogNumberOf(game: Game) {
  return db.game.count({ where: { ...sameOwner(game), createdAt: { lte: game.createdAt } } });
}

export const spotifyInviteRequired = () =>
  new AppError("SPOTIFY_INVITE_REQUIRED", 403);

/** Usuario cuyo Spotify suena en una partida de Spotify. */
function spotifyUserOf(game: Pick<Game, "userId">) {
  if (!game.userId) throw new AppError("SPOTIFY_NOT_CONNECTED", 409, { key: "GAME_WITHOUT_SPOTIFY" });
  return game.userId;
}

async function loadGame(gameId: string) {
  const game = await db.game.findUnique({ where: { id: gameId }, include: { players: { include: { members: true } }, rounds: true, participants: true },
  });
  if (!game) throw new AppError("GAME_NOT_FOUND", 404);
  return game;
}

export async function loadRound(gameId: string, roundId: string) {
  const round = await db.round.findUnique({ where: { id: roundId }, include: { game: true } });
  if (!round || round.gameId !== gameId) throw new AppError("ROUND_NOT_FOUND", 404);
  return round;
}

async function loadPlayer(gameId: string, playerId: string) {
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player || player.gameId !== gameId) throw new AppError("PLAYER_NOT_FOUND", 404);
  return player;
}

/** La partida acaba de terminar: avisa a las pantallas y la cuenta en la analítica. */
async function announceFinished(gameId: string) {
  emit({ type: "game_finished", gameId });
  await recordGameEvent("game_finished", gameId);
}

/** Si la ronda que se acaba de cerrar era la última, termina la partida. */
async function finishIfLastRound(tx: Prisma.TransactionClient, game: Game, roundNumber: number) {
  if (roundNumber >= game.totalRounds) {
    await tx.game.update({ where: { id: game.id }, data: { status: "FINISHED" } });
    return true;
  }
  return false;
}

// ---------- Selección y precarga de canciones ----------

/** Canción elegida (lo que se guarda en `Game.nextTrack`). */
type PreparedTrack = PickedTrack;

async function chooseTrack(game: Game & { rounds: Round[] }, exclude: string[] = []): Promise<PreparedTrack> {
  const filters = gameFiltersSchema.parse(JSON.parse(game.filters));
  const usedTrackIds = new Set([...game.rounds.map((r) => r.trackId), ...exclude]);
  if (game.mode === "open") return pickOpenTrack({ filters, usedTrackIds, source: itunesSource });
  const picked = await pickTrack({
    filters,
    fragmentMs: game.fragmentSeconds * 1000,
    usedTrackIds,
    source: spotifySourceFor(spotifyUserOf(game)),
    searchPageSize: SEARCH_PAGE_SIZE,
    playlistPageSize: PLAYLIST_PAGE_SIZE,
    maxSearchOffset: SEARCH_MAX_OFFSET,
  });
  return picked;
}

/** Elige en segundo plano la canción de la próxima ronda y la guarda en la partida. */
export async function prepareNextTrack(gameId: string) {
  const game = await loadGame(gameId);
  // La próxima ronda es siempre currentRound + 1 (haya o no una en curso).
  if (game.status === "FINISHED" || game.currentRound >= game.totalRounds) return;
  if (game.nextTrack && game.nextTrackFilters === game.filters) return;

  const prepared = await chooseTrack(game);
  // Solo guarda si nadie cambió los filtros mientras tanto.
  await db.game.updateMany({
    where: { id: gameId, filters: game.filters },
    data: { nextTrack: JSON.stringify(prepared), nextTrackFilters: game.filters },
  });
}

/** Programa la precarga para después de responder (no retrasa la petición actual). */
function schedulePreload(gameId: string) {
  after(() =>
    prepareNextTrack(gameId).catch((err) => console.warn(`Precarga fallida para la partida ${gameId}`, err)),
  );
}

/** Usa la canción precargada si sigue siendo válida; si no, elige una ahora. */
async function takeNextTrack(game: Game & { rounds: Round[] }): Promise<PreparedTrack> {
  if (game.nextTrack && game.nextTrackFilters === game.filters) {
    const prepared = JSON.parse(game.nextTrack) as PreparedTrack;
    if (!game.rounds.some((r) => r.trackId === prepared.track.id)) return prepared;
  }
  return chooseTrack(game);
}

// ---------- Casos de uso ----------

export async function createGame(
  input: CreateGameInput,
  owner: Owner,
  /** `replay`: viene de «Otra igual». `record: false`: quien llama anota el evento (por si deshace la creación). */
  opts: { replay?: boolean; record?: boolean } = {},
): Promise<PublicGame> {
  const data = createGameSchema.parse(input);
  if (data.mode === "spotify") {
    // Un invitado no tiene Spotify: para él el modo ni existe.
    if (owner.kind !== "user") throw new AppError("NOT_FOUND", 404);
    if (!owner.spotifyAllowed) throw spotifyInviteRequired();
    if (!(await db.spotifyAccount.count({ where: { userId: owner.userId } }))) {
      throw new AppError("SPOTIFY_NOT_LINKED", 409);
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const game = await db.game.create({
        data: {
          code: generateCode(),
          ...ownerData(owner),
          mode: data.mode,
          totalRounds: data.rounds,
          fragmentSeconds: data.fragmentSeconds,
          filters: JSON.stringify(data.filters),
          format: data.format,
          answerSeconds: data.answerSeconds,
          lockout: data.lockout,
          maxTeamSize: data.format === "teams" ? data.maxTeamSize : null,
          players: {
            create:
              data.format === "teams"
                ? data.teams.map((t) => ({
                    name: t.name,
                    color: t.color,
                    members: { create: t.members.map((name) => ({ name })) },
                  }))
                : data.players.map((name) => ({ name })),
          },
        },
        include: { players: { include: { members: true } }, rounds: true },
      });
      emit({ type: "game_created", gameId: game.id });
      if (opts.record !== false) {
        await recordEvent({
          type: "game_created",
          gameId: game.id,
          mode: data.mode,
          format: data.format,
          ownerKind: ownerKindOf(owner),
          replay: !!opts.replay,
        });
      }
      schedulePreload(game.id);
      return toPublicGame(game, await catalogNumberOf(game));
    } catch (err) {
      // Colisión del código corto: reintenta con otro.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new AppError("CODE_GENERATION_FAILED", 500);
}

/** Lo necesario para grabar otra partida igual: ajustes, filtros y quién juega (jugadores, o equipos con sus miembros). */
function replayInput(game: Game & { players: PlayerWithMembers[] }): CreateGameInput {
  const base = {
    mode: game.mode as GameMode,
    format: game.format as GameFormat,
    rounds: game.totalRounds,
    fragmentSeconds: game.fragmentSeconds,
    answerSeconds: game.answerSeconds,
    lockout: game.lockout as "person" | "team",
    filters: gameFiltersSchema.parse(JSON.parse(game.filters)),
  };
  if (game.format === "teams") {
    return {
      ...base,
      maxTeamSize: game.maxTeamSize ?? undefined,
      teams: game.players.map((p) => ({
        name: p.name,
        color: p.color as TeamInput["color"],
        members: p.members.map((m) => m.name),
      })),
    };
  }
  return { ...base, players: game.players.map((p) => p.name) };
}

/**
 * «Otra igual»: graba una partida nueva con los mismos ajustes y las mismas personas que una ya terminada.
 * Los móviles que estaban unidos pasan a la nueva solos (aviso `next_game`). Si ya se grabó una, devuelve esa:
 * un doble clic (o dos pestañas) no crea dos.
 */
export async function replayGame(gameId: string, owner: Owner): Promise<PublicGame> {
  const old = await loadGame(gameId);
  if (old.status !== "FINISHED") throw new AppError("GAME_NOT_FINISHED", 409);
  if (old.nextGameId) return getGame(old.nextGameId);

  const created = await createGame(replayInput(old), owner, { replay: true, record: false });
  // Quien llegue primero se queda con el enlace; la otra copia (doble clic simultáneo) se tira.
  const claimed = await db.game.updateMany({ where: { id: gameId, nextGameId: null }, data: { nextGameId: created.id } });
  if (!claimed.count) {
    await db.game.delete({ where: { id: created.id } });
    const winner = await db.game.findUniqueOrThrow({ where: { id: gameId }, select: { nextGameId: true } });
    if (!winner.nextGameId) throw new AppError("GAME_NOT_FOUND", 404);
    return getGame(winner.nextGameId);
  }
  await recordEvent({
    type: "game_created",
    gameId: created.id,
    mode: created.mode,
    format: created.format,
    ownerKind: ownerKindOf(owner),
    replay: true,
  });
  emit({ type: "next_game", gameId, nextGameId: created.id });
  return created;
}

export async function getGame(gameId: string): Promise<PublicGame> {
  const game = await loadGame(gameId);
  return toPublicGame(game, await catalogNumberOf(game));
}

/** Últimas partidas del dueño con su podio (máximo 3), de la más reciente a la más antigua. */
export async function listGames(owner: Owner, limit = 12) {
  const where = ownerWhere(owner);
  const [games, total] = await Promise.all([
    db.game.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { players: { include: { members: true } }, _count: { select: { rounds: { where: { status: { not: "PLAYING" } } } } } },
    }),
    db.game.count({ where }),
  ]);
  return {
    total,
    games: games.map((g, i) => {
      const players = toPublicPlayers(g.players);
      return {
        id: g.id,
        catalogNumber: total - i,
        createdAt: g.createdAt,
        mode: g.mode as GameMode,
        status: g.status as GameStatus,
        totalRounds: g.totalRounds,
        playedRounds: g._count.rounds,
        format: g.format as GameFormat,
        /** Jugadores sueltos o equipos. */
        playerCount: g.players.length,
        /** Personas en total (en equipos, la suma de sus miembros). */
        peopleCount: g.format === "teams" ? g.players.reduce((n, p) => n + p.members.length, 0) : g.players.length,
        // Empates: comparten puesto los que tienen los mismos puntos.
        podium: withPlaces(players).slice(0, 3),
      };
    }),
  };
}

/** Borra una partida (y sus rondas e intentos). */
export async function deleteGame(gameId: string) {
  await loadGame(gameId);
  await db.game.delete({ where: { id: gameId } });
}

/** Borra todo el historial de un dueño (y nada de nadie más). Devuelve cuántas partidas eran. */
export async function deleteAllGames(owner: Owner) {
  const { count } = await db.game.deleteMany({ where: ownerWhere(owner) });
  return count;
}

/** Añade un jugador (en el futuro, lo usará el flujo de "unirse con el móvil"). */
export async function addPlayer(gameId: string, rawName: string) {
  const name = rawName.trim();
  if (!name || name.length > 30) throw new AppError("INVALID_NAME", 422);
  const game = await loadGame(gameId);
  if (game.status === "FINISHED") throw new AppError("GAME_FINISHED", 409);
  if (game.format === "teams") {
    throw new AppError("TEAMS_GAME", 409);
  }
  if (game.players.length >= MAX_PLAYERS) throw new AppError("GAME_FULL", 409);
  if (game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new AppError("DUPLICATE_PLAYER", 409);
  }
  const player = await db.player.create({ data: { gameId, name } });
  emit({ type: "player_joined", gameId, playerId: player.id, name });
  return { id: player.id, name: player.name, score: player.score, color: null, members: [] as string[] };
}

/** Actualiza los filtros entre rondas (p. ej. cambiar de género a mitad de partida). */
export async function updateFilters(gameId: string, rawFilters: unknown) {
  const filters = gameFiltersSchema.parse(rawFilters);
  const game = await loadGame(gameId);
  if (game.status === "FINISHED") throw new AppError("GAME_FINISHED", 409);
  await db.game.update({
    where: { id: gameId },
    data: { filters: JSON.stringify(filters), nextTrack: null, nextTrackFilters: null },
  });
  schedulePreload(gameId);
  return getGame(gameId);
}

/** Abre la siguiente ronda con la canción precargada (o elige una si no la hay). */
export async function startNextRound(gameId: string) {
  const game = await loadGame(gameId);
  if (game.status === "FINISHED") throw new AppError("GAME_FINISHED", 409);
  if (game.rounds.some((r) => r.status === "PLAYING")) {
    throw new AppError("ROUND_IN_PROGRESS", 409);
  }
  if (game.currentRound >= game.totalRounds) {
    throw new AppError("NO_MORE_ROUNDS", 409);
  }

  const { track, startMs, genre, audioUrl } = await takeNextTrack(game);

  const number = game.currentRound + 1;
  try {
    const round = await db.$transaction(async (tx) => {
      const created = await tx.round.create({
        data: {
          gameId,
          number,
          trackId: track.id,
          trackUri: track.uri,
          trackName: track.name,
          artists: JSON.stringify(track.artists),
          artistIds: JSON.stringify(track.artistIds ?? []),
          genre,
          albumImage: track.albumImage,
          audioUrl: audioUrl ?? null,
          durationMs: track.durationMs,
          startMs,
        },
      });
      await tx.game.update({
        where: { id: gameId },
        data: { currentRound: number, status: "PLAYING", nextTrack: null, nextTrackFilters: null },
      });
      return created;
    });
    emit({ type: "round_started", gameId, roundId: round.id, number });
    if (number === 1) await recordGameEvent("game_started", gameId);
    if (number < game.totalRounds) schedulePreload(gameId);
    return toPublicRound(round, game);
  } catch (err) {
    // Doble clic en "siguiente ronda": la restricción única (gameId, number) evita duplicarla.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("ROUND_ALREADY_CREATED", 409);
    }
    throw err;
  }
}

/**
 * Hace sonar el fragmento. En modo Spotify se lo ordena al reproductor del navegador (Web Playback SDK);
 * en modo abierto el navegador reproduce `audioUrl` por su cuenta. La primera vez arranca el reloj
 * de la ronda (puntos y pistas); repetir no lo reinicia.
 */
export async function playRound(gameId: string, roundId: string, deviceId: string | undefined, offsetMs = 0) {
  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("ROUND_CLOSED", 409);
  // Mientras alguien responde, la canción está parada a propósito: no se reanuda por detrás.
  if (round.buzzParticipantId) throw new AppError("BUZZ_ACTIVE", 409);
  // `offsetMs` > 0 retoma el fragmento a medias (p. ej. tras recargar la página).
  const fragmentMs = round.game.fragmentSeconds * 1000;
  const offset = Math.min(Math.max(0, Math.round(offsetMs)), fragmentMs);
  let usedDeviceId: string | null = null;
  if (round.game.mode !== "open") {
    if (!deviceId) throw new AppError("DEVICE_REQUIRED", 422);
    usedDeviceId = await startPlayback(spotifyUserOf(round.game), deviceId, round.trackUri, round.startMs + offset);
  }
  await db.round.updateMany({ where: { id: roundId, playStartedAt: null }, data: { playStartedAt: new Date() } });
  // Volver a reproducir también reanuda el reloj si estaba en pausa.
  if (round.pausedAt) await resumeClock(roundId);
  const updated = await db.round.findUniqueOrThrow({ where: { id: roundId } });
  // Los móviles esperan este aviso para encender «¡Lo sé!».
  emit({ type: "round_playing", gameId, roundId });
  return {
    startMs: round.startMs,
    fragmentMs,
    /** Lo que queda de fragmento desde el punto en que se reanudó. */
    remainingMs: fragmentMs - offset,
    deviceId: usedDeviceId,
    audioUrl: round.audioUrl,
    round: toPublicRound(updated, round.game),
  };
}

export async function resumeClock(roundId: string) {
  const round = await db.round.findUniqueOrThrow({ where: { id: roundId } });
  if (!round.pausedAt) return round;
  return db.round.update({
    where: { id: roundId },
    data: { pausedAt: null, pausedMs: round.pausedMs + Math.max(0, Date.now() - round.pausedAt.getTime()) },
  });
}

/** Pausa el reloj de la ronda (puntos y pistas). El audio lo pausa el navegador. */
export async function pauseRound(gameId: string, roundId: string) {
  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("ROUND_CLOSED", 409);
  if (!round.playStartedAt) throw new AppError("ROUND_NOT_STARTED", 409);
  await db.round.updateMany({ where: { id: roundId, pausedAt: null }, data: { pausedAt: new Date() } });
  const updated = await db.round.findUniqueOrThrow({ where: { id: roundId } });
  emit({ type: "round_paused", gameId, roundId });
  return toPublicRound(updated, round.game);
}

/** Reanuda el reloj de la ronda tras una pausa. */
export async function resumeRound(gameId: string, roundId: string) {
  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("ROUND_CLOSED", 409);
  // Si alguien tenía el turno, seguir es cancelárselo (sin dejarle fuera de la ronda).
  if (round.buzzParticipantId) {
    const cleared = await db.round.updateMany({
      where: { id: roundId, buzzParticipantId: round.buzzParticipantId },
      data: { buzzParticipantId: null, buzzedAt: null, buzzDeadline: null },
    });
    if (cleared.count) {
      emit({
        type: "buzz_resolved",
        gameId,
        roundId,
        participantId: round.buzzParticipantId,
        name: "",
        correct: false,
        outcome: "cancelled",
      });
    }
  }
  const updated = await resumeClock(roundId);
  emit({ type: "round_resumed", gameId, roundId });
  return toPublicRound(updated, round.game);
}

interface Award {
  points: number;
  titleAwarded: boolean;
  artistAwarded: boolean;
  gameFinished: boolean;
}

/**
 * Reparte puntos dentro de una transacción. Los `updateMany` condicionales garantizan que
 * solo el primero se lleva el título y solo uno el artista, aunque lleguen a la vez.
 */
export async function award(
  tx: Prisma.TransactionClient,
  round: Round & { game: Game },
  playerId: string,
  { title, artist, at }: { title: boolean; artist: boolean; at: Date },
): Promise<Award> {
  const result: Award = { points: 0, titleAwarded: false, artistAwarded: false, gameFinished: false };
  const rules = rulesFor(round.game.mode);

  if (artist && artistAvailable(round, at, rules)) {
    const claimed = await tx.round.updateMany({
      where: { id: round.id, artistWinnerPlayerId: null },
      data: { artistWinnerPlayerId: playerId },
    });
    if (claimed.count) {
      result.points += ARTIST_POINTS;
      result.artistAwarded = true;
    }
  }

  if (title) {
    const won = await tx.round.updateMany({
      // REVEALED solo llega aquí desde la corrección manual (ronda sin ganador).
      where: { id: round.id, winnerPlayerId: null, status: { in: ["PLAYING", "REVEALED"] } },
      data: { status: "WON", winnerPlayerId: playerId },
    });
    if (won.count) {
      result.points += pointsForElapsed(elapsedMs(round, at), rules);
      result.titleAwarded = true;
      // Si estaba revelada, la partida ya se cerró (o no) al revelarla.
      if (round.status === "PLAYING") result.gameFinished = await finishIfLastRound(tx, round.game, round.number);
    }
  }

  if (result.points) {
    await tx.player.update({ where: { id: playerId }, data: { score: { increment: result.points } } });
  }
  return result;
}

export async function emitAward(gameId: string, roundId: string, playerId: string, a: Award) {
  if (a.artistAwarded) emit({ type: "artist_guessed", gameId, roundId, playerId });
  if (a.titleAwarded) emit({ type: "round_won", gameId, roundId, playerId });
  if (a.gameFinished) await announceFinished(gameId);
}

export async function guessResult(gameId: string, roundId: string) {
  const game = await loadGame(gameId);
  const round = game.rounds.find((r) => r.id === roundId)!;
  return {
    round: toPublicRound(round, game),
    players: toPublicPlayers(game.players),
    gameStatus: game.status as GameStatus,
  };
}

/** Un jugador intenta adivinar el título, el artista o ambos. */
export async function submitGuess(
  gameId: string,
  roundId: string,
  playerId: string,
  input: { title?: string; artist?: string },
) {
  const title = input.title?.trim() || null;
  const artist = input.artist?.trim() || null;
  if (!title && !artist) throw new AppError("EMPTY_GUESS", 422);

  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("ROUND_CLOSED", 409);
  if (!round.playStartedAt) throw new AppError("ROUND_NOT_STARTED", 409);
  await loadPlayer(gameId, playerId);

  const at = new Date();
  const titleCorrect = !!title && isCorrectGuess(title, round.trackName);
  const artistCorrect = !!artist && isCorrectArtist(artist, JSON.parse(round.artists));

  const result = await db.$transaction(async (tx) => {
    const a = await award(tx, round, playerId, { title: titleCorrect, artist: artistCorrect, at });
    await tx.guess.create({
      data: { roundId, playerId, titleText: title, artistText: artist, titleCorrect, artistCorrect, points: a.points, createdAt: at },
    });
    return a;
  });

  emit({ type: "guess_submitted", gameId, roundId, playerId, correct: titleCorrect || artistCorrect });
  await emitAward(gameId, roundId, playerId, result);

  return {
    titleCorrect,
    artistCorrect,
    titleAwarded: result.titleAwarded,
    artistAwarded: result.artistAwarded,
    points: result.points,
    ...(await guessResult(gameId, roundId)),
  };
}

/**
 * El anfitrión da por buena una respuesta que el comparador rechazó.
 * Puntúa como si se hubiera aceptado en el momento del intento.
 */
export async function overrideGuess(
  gameId: string,
  roundId: string,
  guessId: string,
  input: { title?: boolean; artist?: boolean },
) {
  if (!input.title && !input.artist) throw new AppError("EMPTY_OVERRIDE", 422);
  const round = await loadRound(gameId, roundId);
  const guess = await db.guess.findUnique({ where: { id: guessId } });
  if (!guess || guess.roundId !== roundId) throw new AppError("GUESS_NOT_FOUND", 404);

  if (input.title) {
    if (!guess.titleText) throw new AppError("NO_TITLE_IN_GUESS", 422);
    if (round.winnerPlayerId) throw new AppError("ROUND_ALREADY_WON", 409);
  }
  if (input.artist) {
    if (!guess.artistText) throw new AppError("NO_ARTIST_IN_GUESS", 422);
    if (round.artistWinnerPlayerId) throw new AppError("ARTIST_ALREADY_TAKEN", 409);
    if (!artistAvailable(round, guess.createdAt, rulesFor(round.game.mode))) {
      throw new AppError("ARTIST_HINT_SHOWN", 409);
    }
  }

  const result = await db.$transaction(async (tx) => {
    const a = await award(tx, round, guess.playerId, {
      title: !!input.title,
      artist: !!input.artist,
      at: guess.createdAt,
    });
    if (a.points) {
      await tx.guess.update({
        where: { id: guessId },
        data: {
          overridden: true,
          points: { increment: a.points },
          ...(a.titleAwarded ? { titleCorrect: true } : {}),
          ...(a.artistAwarded ? { artistCorrect: true } : {}),
        },
      });
    }
    return a;
  });
  if (!result.points) throw new AppError("OVERRIDE_NOT_APPLIED", 409);

  await emitAward(gameId, roundId, guess.playerId, result);
  return {
    titleAwarded: result.titleAwarded,
    artistAwarded: result.artistAwarded,
    points: result.points,
    ...(await guessResult(gameId, roundId)),
  };
}

/**
 * El anfitrión da el título o el artista a un jugador que lo dijo en voz alta, sin escribirlo
 * (el mando de la tele no tiene teclado). Queda en los intentos como respuesta «de palabra».
 */
export async function awardSpoken(
  gameId: string,
  roundId: string,
  playerId: string,
  input: { title?: boolean; artist?: boolean },
) {
  if (!input.title && !input.artist) throw new AppError("EMPTY_AWARD", 422);
  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("ROUND_CLOSED", 409);
  if (!round.playStartedAt) throw new AppError("ROUND_NOT_STARTED", 409);
  await loadPlayer(gameId, playerId);

  const at = new Date();
  const result = await db.$transaction(async (tx) => {
    const a = await award(tx, round, playerId, { title: !!input.title, artist: !!input.artist, at });
    if (a.points) {
      await tx.guess.create({
        data: {
          roundId,
          playerId,
          titleCorrect: a.titleAwarded,
          artistCorrect: a.artistAwarded,
          overridden: true,
          points: a.points,
          createdAt: at,
        },
      });
    }
    return a;
  });
  if (!result.points) {
    throw new AppError("AWARD_NOT_APPLIED", 409, { key: input.title ? "AWARD_NOT_APPLIED" : "AWARD_ARTIST_NOT_APPLIED" });
  }

  await emitAward(gameId, roundId, playerId, result);
  return {
    titleAwarded: result.titleAwarded,
    artistAwarded: result.artistAwarded,
    points: result.points,
    ...(await guessResult(gameId, roundId)),
  };
}

/** Nadie la adivinó (o se acabó el fragmento): cierra la ronda y muestra la respuesta. */
export async function revealRound(gameId: string, roundId: string) {
  const round = await loadRound(gameId, roundId);
  if (round.status === "PLAYING") {
    const finished = await db.$transaction(async (tx) => {
      const updated = await tx.round.updateMany({
        where: { id: roundId, status: "PLAYING" },
        data: { status: "REVEALED", buzzParticipantId: null, buzzedAt: null, buzzDeadline: null },
      });
      return updated.count > 0 && (await finishIfLastRound(tx, round.game, round.number));
    });
    emit({ type: "round_revealed", gameId, roundId });
    if (finished) await announceFinished(gameId);
  }
  const game = await getGame(gameId);
  return {
    round: game.history.find((r) => r.id === roundId)!,
    players: game.players,
    gameStatus: game.status,
  };
}

export async function getRoundGuesses(gameId: string, roundId: string) {
  const round = await loadRound(gameId, roundId);
  const guesses = await db.guess.findMany({
    where: { roundId },
    orderBy: { createdAt: "asc" },
    include: { player: { select: { name: true } } },
  });
  return guesses.map((g) => ({
    id: g.id,
    playerId: g.playerId,
    playerName: g.player.name,
    title: g.titleText,
    artist: g.artistText,
    titleCorrect: g.titleCorrect,
    artistCorrect: g.artistCorrect,
    points: g.points,
    overridden: g.overridden,
    /** Respondió desde su móvil (no lo registró el anfitrión). */
    viaPhone: !!g.participantId,
    /** Segundos de ronda en que se hizo el intento. */
    atMs: elapsedMs(round, g.createdAt),
    createdAt: g.createdAt,
  }));
}
