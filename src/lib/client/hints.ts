import { plural } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import type { Round } from "@/lib/client/api";
import { HINT_ORDER, type HintType, type RoundRules } from "@/lib/game/scoring";

/** Margen tras la hora prevista de una pista antes de pedirla al servidor. */
export const HINT_REFRESH_DELAY_MS = 200;

/** Una marca de pista tal como se pinta. */
export interface HintMark {
  key: string;
  label: string;
  at: string;
  /** Valor ya desbloqueado (o null si aún no). */
  value: string | null;
  unlocked: boolean;
}

/** Los textos que hacen falta para redactar las pistas (`m.game`). */
interface HintTexts {
  hintLabels: Record<HintType, string>;
  wordCount: { one: string; other: string };
}

/** Las tres marcas de pista, con el segundo en que sale cada una según las reglas de la partida. */
export function hintSlots(rules: RoundRules, labels: Record<HintType, string>) {
  return HINT_ORDER.map((key) => ({
    key,
    label: labels[key],
    at: `${rules.hintAtMs[key] / 1000} s`,
  }));
}

/** Las marcas de la ronda: cuáles ya salieron y qué dicen, en el idioma de la pantalla. */
export function hintMarks(round: Pick<Round, "hints">, rules: RoundRules, texts: HintTexts, locale: Locale): HintMark[] {
  return hintSlots(rules, texts.hintLabels).map((slot) => {
    const got = round.hints.find((h) => h.type === slot.key);
    // La pista de palabras llega como número: se redacta aquí.
    const value =
      got?.type === "words" && got.value ? plural(locale, Number(got.value), texts.wordCount) : (got?.value ?? null);
    return { ...slot, value, unlocked: !!got };
  });
}
