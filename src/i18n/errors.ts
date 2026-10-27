import { DEFAULT_LOCALE, type Locale } from "./locales";
import { errors as en } from "./messages/en/errors";
import { errors as es } from "./messages/es/errors";

/** Mensajes de error de la API en cada idioma (sin depender de React: lo usa el servidor). */
const ERRORS: Record<Locale, typeof es> = { es, en };

export type ErrorKey = keyof typeof es;
export type ErrorParams = Record<string, string | number>;

export const isErrorKey = (key: unknown): key is ErrorKey => typeof key === "string" && key in es;

/** Texto de un error en un idioma. Los que llevan datos (`TEAM_FULL`, `BUZZ_TAKEN`) reciben `params`. */
export function errorMessage(locale: Locale, key: ErrorKey, params: ErrorParams = {}): string {
  const entry = (ERRORS[locale] ?? ERRORS[DEFAULT_LOCALE])[key] as string | ((p: ErrorParams) => string);
  return typeof entry === "function" ? entry(params) : entry;
}
