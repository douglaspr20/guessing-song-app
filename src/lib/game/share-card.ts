import { formatDate, formatList, plural } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { MESSAGES } from "@/i18n/messages";
import { catalogLabel } from "@/lib/client/api";
import { winnerSummary } from "./standings";

/**
 * Lo que enseña el enlace público de un resultado: nombres, miembros, puntos, número de casete, fecha y pistas.
 * Nada más: ni canciones, ni filtros, ni el código de unirse, ni ids internos.
 */
export interface SharedPlayer {
  /** Posición en la lista (no el id interno). */
  id: string;
  name: string;
  score: number;
  /** Puesto (los empates comparten puesto). */
  place: number;
  color: string | null;
  members: string[];
}

export interface SharedResult {
  locale: Locale;
  catalogNumber: number;
  createdAt: Date;
  totalRounds: number;
  /** De más a menos puntos. */
  players: SharedPlayer[];
}

/** Cuántos jugadores caben en la lista que va debajo del podio de la tarjeta. */
export const CARD_REST_MAX = 5;

export interface CardEntry {
  place: number;
  name: string;
  score: number;
  /** Los miembros del equipo; vacío si juega solo. */
  members: string[];
  color: string | null;
}

/** La tarjeta del resultado ya decidida y redactada: la usan la imagen y la página pública. */
export interface CardModel {
  locale: Locale;
  brand: string;
  /** «Fin de la cinta». */
  kicker: string;
  /** «Ganó», «Empate entre» o null cuando nadie sumó. */
  headlinePrefix: string | null;
  /** El nombre del ganador, los empatados o «Nadie sumó puntos». */
  headlineText: string;
  /** Alguien sumó puntos: hay podio. */
  scored: boolean;
  podium: CardEntry[];
  rest: CardEntry[];
  /** «y 3 más», si no caben todos. */
  more: string | null;
  /** «C-014». */
  cat: string;
  /** «10 pistas». */
  tracks: string;
  /** «28 oct 2026». */
  date: string;
  /** «C-014 · 10 pistas · 28 oct 2026». */
  meta: string;
  points: string;
}

const entry = (p: SharedPlayer): CardEntry => ({
  place: p.place,
  name: p.name,
  score: p.score,
  members: p.members,
  color: p.color,
});

/**
 * Decide qué sale en la tarjeta y lo redacta en el idioma de quien compartió. `restMax` es cuántos jugadores caben en
 * la lista de debajo del podio (la imagen apaisada tiene menos sitio que la vertical).
 */
export function buildCardModel(result: SharedResult, locale: Locale = result.locale, restMax = CARD_REST_MAX): CardModel {
  const m = MESSAGES[locale];
  const summary = winnerSummary(result.players);
  const scored = summary.kind !== "none";
  const cat = catalogLabel(result.catalogNumber);
  const tracks = plural(locale, result.totalRounds, m.game.tracks);
  const date = formatDate(locale, result.createdAt);
  const headline =
    summary.kind === "none"
      ? { prefix: null, text: m.game.nobodyScored }
      : summary.kind === "tie"
        ? { prefix: m.game.tieBetween, text: formatList(locale, summary.names) }
        : { prefix: m.game.won, text: summary.name };
  const shown = scored ? result.players.slice(3, 3 + restMax) : [];
  const hidden = scored ? Math.max(0, result.players.length - 3 - restMax) : 0;
  return {
    locale,
    brand: m.common.brand,
    kicker: m.game.endOfTape,
    headlinePrefix: headline.prefix,
    headlineText: headline.text,
    scored,
    podium: scored ? result.players.slice(0, 3).map(entry) : [],
    rest: shown.map(entry),
    more: hidden ? m.share.andMore(hidden) : null,
    cat,
    tracks,
    date,
    meta: [cat, tracks, date].join(" · "),
    points: m.common.pts,
  };
}

/** El titular en una línea («Ganó Ana»), para títulos, textos de compartir y descripciones de imagen. */
export const headlineOf = (card: Pick<CardModel, "headlinePrefix" | "headlineText">) =>
  [card.headlinePrefix, card.headlineText].filter(Boolean).join(" ");

const NOT_LATIN = /[^\p{Script=Latin}\p{N}\p{P}\p{Zs}]/gu;
const plain = (text: string) => text.replace(NOT_LATIN, "").trim() || "·";

/**
 * La misma tarjeta con los nombres reducidos a letras latinas, números y signos. Es el plan B de la imagen: si
 * generar un emoji o una letra rara falla (se piden a un servicio externo), la tarjeta sale igualmente.
 */
export function plainCard(card: CardModel): CardModel {
  const clean = (e: CardEntry): CardEntry => ({ ...e, name: plain(e.name), members: e.members.map(plain) });
  return { ...card, headlineText: plain(card.headlineText), podium: card.podium.map(clean), rest: card.rest.map(clean) };
}
