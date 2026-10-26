import { DEFAULT_LOCALE, LOCALE_COOKIE, readCookie, resolveLocale, type Locale } from "./locales";
import { MESSAGES, type Messages } from "./messages";

/**
 * Idioma de esta pestaña para el código que no es un componente (cliente de la API, reproductores).
 * Lo fija `I18nProvider` al pintar; solo tiene sentido en el navegador (en el servidor varias peticiones
 * comparten este módulo, por eso allí se usa siempre el idioma de la petición).
 */
let activeLocale: Locale | null = null;

export function setActiveLocale(locale: Locale) {
  if (typeof window !== "undefined") activeLocale = locale;
}

/** El idioma elegido en el navegador (cookie del selector o idiomas del navegador). */
export function browserLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return resolveLocale(readCookie(document.cookie, LOCALE_COOKIE), navigator.languages?.join(",") || navigator.language);
}

export function currentLocale(): Locale {
  return activeLocale ?? browserLocale();
}

/** Textos del idioma actual, para usar fuera de los componentes. */
export function currentMessages(): Messages {
  return MESSAGES[currentLocale()];
}
