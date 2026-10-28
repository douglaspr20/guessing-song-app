import "server-only";
import { randomToken } from "@/lib/access/hash";
import { recordGameEvent } from "@/lib/analytics/events";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locales";
import { buildCardModel, headlineOf, type SharedResult } from "./share-card";
import { catalogNumberOf, toPublicPlayers } from "./service";
import { withPlaces } from "./standings";

/** 12 bytes aleatorios en base64url: 16 caracteres, 96 bits (no se puede adivinar). */
const TOKEN_BYTES = 12;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16}$/;
export const isShareToken = (value: string) => TOKEN_SHAPE.test(value);

/**
 * Crea el enlace público del resultado de una partida terminada (la primera vez) o devuelve el que ya tenía:
 * un doble clic, o la tele y un móvil a la vez, comparten el mismo.
 */
export async function shareGame(gameId: string, locale: Locale): Promise<{ token: string }> {
  const game = await db.game.findUnique({ where: { id: gameId }, select: { status: true, shareToken: true } });
  if (!game) throw new AppError("GAME_NOT_FOUND", 404);
  if (game.status !== "FINISHED") throw new AppError("GAME_NOT_FINISHED", 409);
  if (game.shareToken) return { token: game.shareToken };

  const token = randomToken(TOKEN_BYTES);
  const claimed = await db.game.updateMany({
    where: { id: gameId, shareToken: null },
    data: { shareToken: token, shareLocale: locale },
  });
  if (!claimed.count) {
    // Otro clic llegó primero.
    const winner = await db.game.findUniqueOrThrow({ where: { id: gameId }, select: { shareToken: true } });
    if (!winner.shareToken) throw new AppError("GAME_NOT_FOUND", 404);
    return { token: winner.shareToken };
  }
  await recordGameEvent("result_shared", gameId);
  return { token };
}

/** «Dejar de compartir»: el enlace y la imagen dejan de funcionar. */
export async function unshareGame(gameId: string) {
  await db.game.update({ where: { id: gameId }, data: { shareToken: null, shareLocale: null } });
}

/**
 * Lo público de un resultado compartido, o null si el código no existe, ya no se comparte o la partida no
 * terminó. Es lo único que lee la página pública y la imagen: nada de canciones, filtros ni ids internos.
 */
export async function getSharedResult(token: string): Promise<SharedResult | null> {
  if (!isShareToken(token)) return null;
  const game = await db.game.findUnique({
    where: { shareToken: token },
    include: { players: { include: { members: true } } },
  });
  if (!game || game.status !== "FINISHED") return null;
  const players = withPlaces(toPublicPlayers(game.players)).map((p, i) => ({
    id: String(i + 1),
    name: p.name,
    score: p.score,
    place: p.place,
    color: p.color,
    members: p.members,
  }));
  return {
    locale: isLocale(game.shareLocale) ? game.shareLocale : DEFAULT_LOCALE,
    catalogNumber: await catalogNumberOf(game),
    createdAt: game.createdAt,
    totalRounds: game.totalRounds,
    players,
  };
}

/** Lo que recibe la pantalla al compartir: el código y el titular («Ganó Ana»), para el texto de «Compartir…». */
export async function shareAndDescribe(gameId: string, locale: Locale) {
  const { token } = await shareGame(gameId, locale);
  const result = await getSharedResult(token);
  if (!result) throw new AppError("GAME_NOT_FOUND", 404);
  const card = buildCardModel(result, locale);
  return { token, headline: headlineOf(card), cat: card.cat };
}
