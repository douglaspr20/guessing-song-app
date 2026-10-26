import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locales";
import { MESSAGES, type Messages } from "./messages";

/** Idioma de la petición en curso (componentes de servidor): cookie del selector o `Accept-Language`. */
export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
}

export async function getMessages(): Promise<{ locale: Locale; m: Messages }> {
  const locale = await getLocale();
  return { locale, m: MESSAGES[locale] };
}
