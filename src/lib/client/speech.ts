import type { Locale } from "@/i18n/locales";

/** Idioma de la música elegido en la partida → idioma del reconocimiento de voz (BCP 47). */
const MUSIC_TO_SPEECH: Record<string, string> = {
  es: "es-ES",
  "es-latam": "es-MX",
  en: "en-US",
  pt: "pt-BR",
  fr: "fr-FR",
  it: "it-IT",
  de: "de-DE",
  ko: "ko-KR",
  ja: "ja-JP",
};

const UI_TO_SPEECH: Record<Locale, string> = { es: "es-ES", en: "en-US" };

/**
 * En qué idioma escuchar al dictar: el de la música de la partida (los títulos suelen ir en ese idioma) y, si no se
 * eligió, el de la pantalla.
 */
export function speechLang(musicLanguage: string | null | undefined, uiLocale: Locale): string {
  return (musicLanguage && MUSIC_TO_SPEECH[musicLanguage]) || UI_TO_SPEECH[uiLocale];
}
