import { plural } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";

/** Lo que dicen las pantallas de partida en la banda: «C-014 · Pista 3 de 10» o «C-014 · 10 pistas». */
export function trackStatus(
  catalog: string,
  roundNumber: number | null,
  totalRounds: number,
  text: { trackOf: (n: number, total: number) => string; tracks: { one: string; other: string } },
  locale: Locale,
) {
  return roundNumber
    ? `${catalog} · ${text.trackOf(roundNumber, totalRounds)}`
    : `${catalog} · ${plural(locale, totalRounds, text.tracks)}`;
}
