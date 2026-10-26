"use client";

import { BrokenTapeScreen } from "@/components/errors/BrokenTapeScreen";
import { useI18n } from "@/i18n/client";
import { fontClasses } from "./fonts";
import "./globals.css";

/** Falló hasta el layout raíz: esta página trae su propio documento, fuentes y estilos (y lee el idioma de la cookie). */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const { m, locale } = useI18n();
  return (
    <html lang={locale} className={fontClasses}>
      <body>
        <title>{m.common.errorPage.globalTitle}</title>
        <BrokenTapeScreen error={error} retry={retry} standalone />
      </body>
    </html>
  );
}
