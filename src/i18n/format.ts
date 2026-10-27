import type { Locale } from "./locales";

/** Forma singular o plural según las reglas del idioma («1 pista», «2 pistas»). */
export function plural(locale: Locale, count: number, forms: { one: string; other: string }): string {
  const form = new Intl.PluralRules(locale).select(count) === "one" ? forms.one : forms.other;
  return form.replace("{n}", String(count));
}

const dateFormats = new Map<Locale, Intl.DateTimeFormat>();

/** Fecha corta («24 oct 2026» / «Oct 24, 2026»). */
export function formatDate(locale: Locale, iso: string | Date): string {
  let fmt = dateFormats.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    dateFormats.set(locale, fmt);
  }
  return fmt.format(new Date(iso));
}

/** Lista legible: «Ana, Luis y Marta» / «Ana, Luis and Marta». */
export function formatList(locale: Locale, items: string[]): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
}

/** Orden alfabético según el idioma. */
export const compareText = (locale: Locale) => (a: string, b: string) => a.localeCompare(b, locale);
