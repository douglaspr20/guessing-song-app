"use client";

import { createContext, use, useEffect, useMemo, type ReactNode } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./locales";
import { MESSAGES, type Messages } from "./messages";
import { browserLocale, setActiveLocale } from "./runtime";

interface I18n {
  locale: Locale;
  m: Messages;
}

const I18nContext = createContext<I18n | null>(null);

/** Pone el idioma (resuelto en el servidor con la cookie o el navegador) a disposición de toda la app. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  setActiveLocale(locale);
  useEffect(() => {
    // El HTML estático sale con lang="es"; aquí se corrige para lectores de pantalla y el traductor del navegador.
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(() => ({ locale, m: MESSAGES[locale] }), [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

/** Idioma y textos de la pantalla: `const { m, locale } = useI18n()`. Sin proveedor (error global), los del navegador. */
export function useI18n(): I18n {
  const ctx = use(I18nContext);
  if (ctx) return ctx;
  const locale = browserLocale();
  return { locale, m: MESSAGES[locale] };
}

/** Guarda el idioma elegido y recarga para que el servidor pinte todo en ese idioma. */
export function chooseLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  window.location.reload();
}
