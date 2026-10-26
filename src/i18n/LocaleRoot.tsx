import type { ReactNode } from "react";
import { I18nProvider } from "./client";
import { getLocale } from "./server";

/** Lee el idioma de la petición y envuelve la app con sus textos. Va dentro de un <Suspense> en el layout. */
export async function LocaleRoot({ children }: { children: ReactNode }) {
  return <I18nProvider locale={await getLocale()}>{children}</I18nProvider>;
}
