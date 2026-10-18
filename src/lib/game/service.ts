import "server-only";
import { randomInt } from "node:crypto";
import { after } from "next/server";
import { Prisma, type Game, type Player, type Round } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { startPlayback } from "@/lib/spotify/playback";
import {
  getPlaylistTracks,
  searchTracks,
  SEARCH_MAX_OFFSET,
  SEARCH_PAGE_SIZE,
  PLAYLIST_PAGE_SIZE,
} from "@/lib/spotify/sources";
import { emit } from "./events";
import { createGameSchema, gameFiltersSchema, type CreateGameInput, type GameFilters } from "./filters";
import { isCorrectArtist, isCorrectGuess } from "./matcher";
import { ARTIST_POINTS, artistAvailable, elapsedMs, pointsForElapsed, unlockedHints, type RoundClock } from "./scoring";
import { pickTrack, type PickedTrack, type TrackSource } from "./track-picker";

export type GameStatus = "LOBBY" | "PLAYING" | "FINISHED";
export type RoundStatus = "PLAYING" | "WON" | "REVEALED";

export const spotifySource: TrackSource = {
  search: (p) => searchTracks(p),
  playlist: ({ playlistId, ...rest }) => getPlaylistTracks(playlistId, rest),
};

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

export function toPublicRound(round: Round, fragmentSeconds: number, now = new Date()) {
  const closed = round.status !== "PLAYING";
  const clock = roundClock(round);
  const elapsed = elapsedMs(clock, now);
  const { hints, nextHintAt } = unlockedHints(clock, now, closed);
  return {
    id: round.id,
    number: round.number,
    status: round.status as RoundStatus,
    startMs: round.startMs,
    fragmentMs: fragmentSeconds * 1000,
    /** `null` hasta que suena por primera vez. */
    playStartedAt: round.playStartedAt,
    /** El anfitrión pausó: el reloj de puntos y pistas está parado. */
    paused: !!round.pausedAt,
    elapsedMs: elapsed,
    /** Lo que vale acertar el título ahora mismo (null si la ronda está cerrada). */
    pointsNow: closed ? null : pointsForElapsed(elapsed),
    artistAvailable: !closed && !round.artistWinnerPlayerId && artistAvailable(clock, now),
    hints,
    nextHintAt: closed ? null : nextHintAt,
    winnerPlayerId: round.winnerPlayerId,
    artistWinnerPlayerId: round.artistWinnerPlayerId,
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

function toPublicPlayers(players: Player[]) {
  return [...players]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((p) => ({ id: p.id, name: p.name, score: p.score }));
}

function toPublicGame(game: Game & { players: Player[]; rounds: Round[] }, catalogNumber: number) {
  const now = new Date();
  const current = game.rounds.find((r) => r.number === game.currentRound) ?? null;
  return {
    id: game.id,
    code: game.code,
    /** Número correlativo de la partida (la primera es la 1), para mostrarla como "C-014". */
    catalogNumber,
    createdAt: game.createdAt,
    status: game.status as GameStatus,
    totalRounds: game.totalRounds,
    currentRound: game.currentRound,
    fragmentSeconds: game.fragmentSeconds,
    filters: JSON.parse(game.filters) as GameFilters,
    /** Si la siguiente canción ya está elegida (la próxima ronda empezará sin espera). */
    nextTrackReady: !!game.nextTrack && game.nextTrackFilters === game.filters,
    players: toPublicPlayers(game.players),
    round: current ? toPublicRound(current, game.fragmentSeconds, now) : null,
    history: game.rounds
      .filter((r) => r.status !== "PLAYING")
      .sort((a, b) => a.number - b.number)
      .map((r) => toPublicRound(r, game.fragmentSeconds, now)),
  };
}

export type PublicGame = ReturnType<typeof toPublicGame>;

// ---------- Helpers ----------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I

function generateCode(length = 6) {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

async function catalogNumberOf(game: Game) {
  return db.game.count({ where: { createdAt: { lte: game.createdAt } } });
}

async function loadGame(gameId: string) {
  const game = await db.game.findUnique({ where: { id: gameId }, include: { players: true, rounds: true } });
  if (!game) throw new AppError("Partida no encontrada", 404, "GAME_NOT_FOUND");
  return game;
}

async function loadRound(gameId: string, roundId: string) {
  const round = await db.round.findUnique({ where: { id: roundId }, include: { game: true } });
  if (!round || round.gameId !== gameId) throw new AppError("Ronda no encontrada", 404, "ROUND_NOT_FOUND");
  return round;
}

async function loadPlayer(gameId: string, playerId: string) {
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player || player.gameId !== gameId) throw new AppError("Jugador no encontrado", 404, "PLAYER_NOT_FOUND");
  return player;
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
  const picked = await pickTrack({
    filters: gameFiltersSchema.parse(JSON.parse(game.filters)),
    fragmentMs: game.fragmentSeconds * 1000,
    usedTrackIds: new Set([...game.rounds.map((r) => r.trackId), ...exclude]),
    source: spotifySource,
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

export async function createGame(input: CreateGameInput): Promise<PublicGame> {
  const data = createGameSchema.parse(input);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const game = await db.game.create({
        data: {
          code: generateCode(),
          totalRounds: data.rounds,
          fragmentSeconds: data.fragmentSeconds,
          filters: JSON.stringify(data.filters),
          players: { create: data.players.map((name) => ({ name })) },
        },
        include: { players: true, rounds: true },
      });
      emit({ type: "game_created", gameId: game.id });
      schedulePreload(game.id);
      return toPublicGame(game, await catalogNumberOf(game));
    } catch (err) {
      // Colisión del código corto: reintenta con otro.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new AppError("No se pudo generar un código de partida", 500, "CODE_GENERATION_FAILED");
}

export async function getGame(gameId: string): Promise<PublicGame> {
  const game = await loadGame(gameId);
  return toPublicGame(game, await catalogNumberOf(game));
}

/** Últimas partidas con su podio (máximo 3), de la más reciente a la más antigua. */
export async function listGames(limit = 12) {
  const [games, total] = await Promise.all([
    db.game.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { players: true, _count: { select: { rounds: { where: { status: { not: "PLAYING" } } } } } },
    }),
    db.game.count(),
  ]);
  return {
    total,
    games: games.map((g, i) => {
      const players = toPublicPlayers(g.players);
      return {
        id: g.id,
        catalogNumber: total - i,
        createdAt: g.createdAt,
        status: g.status as GameStatus,
        totalRounds: g.totalRounds,
        playedRounds: g._count.rounds,
        playerCount: g.players.length,
        // Empates: comparten puesto los que tienen los mismos puntos.
        podium: players.slice(0, 3).map((p) => ({ ...p, place: players.findIndex((q) => q.score === p.score) + 1 })),
      };
    }),
  };
}

/** Borra una partida (y sus rondas e intentos). */
export async function deleteGame(gameId: string) {
  await loadGame(gameId);
  await db.game.delete({ where: { id: gameId } });
}

/** Añade un jugador (en el futuro, lo usará el flujo de "unirse con el móvil"). */
export async function addPlayer(gameId: string, rawName: string) {
  const name = rawName.trim();
  if (!name || name.length > 30) throw new AppError("Nombre inválido", 422, "INVALID_NAME");
  const game = await loadGame(gameId);
  if (game.status === "FINISHED") throw new AppError("La partida ya terminó", 409, "GAME_FINISHED");
  if (game.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new AppError("Ya hay un jugador con ese nombre", 409, "DUPLICATE_PLAYER");
  }
  const player = await db.player.create({ data: { gameId, name } });
  emit({ type: "player_joined", gameId, playerId: player.id, name });
  return { id: player.id, name: player.name, score: player.score };
}

/** Actualiza los filtros entre rondas (p. ej. cambiar de género a mitad de partida). */
export async function updateFilters(gameId: string, rawFilters: unknown) {
  const filters = gameFiltersSchema.parse(rawFilters);
  const game = await loadGame(gameId);
  if (game.status === "FINISHED") throw new AppError("La partida ya terminó", 409, "GAME_FINISHED");
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
  if (game.status === "FINISHED") throw new AppError("La partida ya terminó", 409, "GAME_FINISHED");
  if (game.rounds.some((r) => r.status === "PLAYING")) {
    throw new AppError("Hay una ronda en curso: adivínala o revélala antes de seguir", 409, "ROUND_IN_PROGRESS");
  }
  if (game.currentRound >= game.totalRounds) {
    throw new AppError("Ya se jugaron todas las rondas", 409, "NO_MORE_ROUNDS");
  }

  const { track, startMs, genre } = await takeNextTrack(game);

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
    if (number < game.totalRounds) schedulePreload(gameId);
    return toPublicRound(round, game.fragmentSeconds);
  } catch (err) {
    // Doble clic en "siguiente ronda": la restricción única (gameId, number) evita duplicarla.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("Esa ronda ya se creó", 409, "ROUND_ALREADY_CREATED");
    }
    throw err;
  }
}

/**
 * Ordena a Spotify reproducir el fragmento en el dispositivo del navegador (Web Playback SDK).
 * La primera vez arranca el reloj de la ronda (puntos y pistas); repetir no lo reinicia.
 */
export async function playRound(gameId: string, roundId: string, deviceId: string, offsetMs = 0) {
  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("La ronda ya está cerrada", 409, "ROUND_CLOSED");
  // `offsetMs` > 0 retoma el fragmento a medias (p. ej. tras recargar la página).
  const fragmentMs = round.game.fragmentSeconds * 1000;
  const offset = Math.min(Math.max(0, Math.round(offsetMs)), fragmentMs);
  const usedDeviceId = await startPlayback(deviceId, round.trackUri, round.startMs + offset);
  await db.round.updateMany({ where: { id: roundId, playStartedAt: null }, data: { playStartedAt: new Date() } });
  // Volver a reproducir también reanuda el reloj si estaba en pausa.
  if (round.pausedAt) await resumeClock(roundId);
  const updated = await db.round.findUniqueOrThrow({ where: { id: roundId } });
  return {
    startMs: round.startMs,
    fragmentMs,
    /** Lo que queda de fragmento desde el punto en que se reanudó. */
    remainingMs: fragmentMs - offset,
    deviceId: usedDeviceId,
    round: toPublicRound(updated, round.game.fragmentSeconds),
  };
}

async function resumeClock(roundId: string) {
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
  if (round.status !== "PLAYING") throw new AppError("La ronda ya está cerrada", 409, "ROUND_CLOSED");
  if (!round.playStartedAt) throw new AppError("La canción aún no ha empezado a sonar", 409, "ROUND_NOT_STARTED");
  await db.round.updateMany({ where: { id: roundId, pausedAt: null }, data: { pausedAt: new Date() } });
  const updated = await db.round.findUniqueOrThrow({ where: { id: roundId } });
  return toPublicRound(updated, round.game.fragmentSeconds);
}

/** Reanuda el reloj de la ronda tras una pausa. */
export async function resumeRound(gameId: string, roundId: string) {
  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("La ronda ya está cerrada", 409, "ROUND_CLOSED");
  const updated = await resumeClock(roundId);
  return toPublicRound(updated, round.game.fragmentSeconds);
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
async function award(
  tx: Prisma.TransactionClient,
  round: Round & { game: Game },
  playerId: string,
  { title, artist, at }: { title: boolean; artist: boolean; at: Date },
): Promise<Award> {
  const result: Award = { points: 0, titleAwarded: false, artistAwarded: false, gameFinished: false };

  if (artist && artistAvailable(round, at)) {
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
      result.points += pointsForElapsed(elapsedMs(round, at));
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

function emitAward(gameId: string, roundId: string, playerId: string, a: Award) {
  if (a.artistAwarded) emit({ type: "artist_guessed", gameId, roundId, playerId });
  if (a.titleAwarded) emit({ type: "round_won", gameId, roundId, playerId });
  if (a.gameFinished) emit({ type: "game_finished", gameId });
}

async function guessResult(gameId: string, roundId: string) {
  const game = await loadGame(gameId);
  const round = game.rounds.find((r) => r.id === roundId)!;
  return {
    round: toPublicRound(round, game.fragmentSeconds),
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
  if (!title && !artist) throw new AppError("Escribe el título o el artista", 422, "EMPTY_GUESS");

  const round = await loadRound(gameId, roundId);
  if (round.status !== "PLAYING") throw new AppError("La ronda ya está cerrada", 409, "ROUND_CLOSED");
  if (!round.playStartedAt) throw new AppError("La canción aún no ha empezado a sonar", 409, "ROUND_NOT_STARTED");
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
  emitAward(gameId, roundId, playerId, result);

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
  if (!input.title && !input.artist) throw new AppError("Indica si das por bueno el título o el artista", 422, "EMPTY_OVERRIDE");
  const round = await loadRound(gameId, roundId);
  const guess = await db.guess.findUnique({ where: { id: guessId } });
  if (!guess || guess.roundId !== roundId) throw new AppError("Intento no encontrado", 404, "GUESS_NOT_FOUND");

  if (input.title) {
    if (!guess.titleText) throw new AppError("Ese intento no tenía título", 422, "NO_TITLE_IN_GUESS");
    if (round.winnerPlayerId) throw new AppError("Esta ronda ya tiene ganador", 409, "ROUND_ALREADY_WON");
  }
  if (input.artist) {
    if (!guess.artistText) throw new AppError("Ese intento no tenía artista", 422, "NO_ARTIST_IN_GUESS");
    if (round.artistWinnerPlayerId) throw new AppError("El punto de artista ya se lo llevó alguien", 409, "ARTIST_ALREADY_TAKEN");
    if (!artistAvailable(round, guess.createdAt)) {
      throw new AppError("Ese intento fue después de la pista del artista", 409, "ARTIST_HINT_SHOWN");
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
  if (!result.points) throw new AppError("No se pudo aplicar: alguien se adelantó", 409, "OVERRIDE_NOT_APPLIED");

  emitAward(gameId, roundId, guess.playerId, result);
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
        data: { status: "REVEALED" },
      });
      return updated.count > 0 && (await finishIfLastRound(tx, round.game, round.number));
    });
    emit({ type: "round_revealed", gameId, roundId });
    if (finished) emit({ type: "game_finished", gameId });
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
    /** Segundos de ronda en que se hizo el intento. */
    atMs: elapsedMs(round, g.createdAt),
    createdAt: g.createdAt,
  }));
}
