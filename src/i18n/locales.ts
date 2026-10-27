/** Idiomas de la interfaz. El primero es el de reserva. Para añadir uno: su diccionario en `messages/` y aquí. */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

/** Cookie con el idioma elegido en el selector (la lee el servidor y el navegador). */
export const LOCALE_COOKIE = "idioma";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Nombre de cada idioma en su propio idioma (para el selector). */
export const LOCALE_NAMES: Record<Locale, string> = { es: "Español", en: "English" };

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** Primer idioma admitido de una cabecera `Accept-Language` («en-US,en;q=0.9,es;q=0.8»), por peso. */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((r) => r.lang && r.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked.map((r) => r.lang).find(isLocale) ?? null;
}

/** Idioma de una petición: el elegido en el selector; si no, el del navegador; si no, español. */
export function resolveLocale(cookie: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookie)) return cookie;
  return fromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/** Lee una cookie de la cabecera `Cookie` cruda. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Idioma de una petición a la API (cookie o `Accept-Language`). */
export function localeFromRequest(req: Request): Locale {
  return resolveLocale(readCookie(req.headers.get("cookie"), LOCALE_COOKIE), req.headers.get("accept-language"));
}
