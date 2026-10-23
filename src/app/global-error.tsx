"use client";

import { BrokenTapeScreen } from "@/components/errors/BrokenTapeScreen";
import { fontClasses } from "./fonts";
import "./globals.css";

/** Falló hasta el layout raíz: esta página trae su propio documento, fuentes y estilos. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es" className={fontClasses}>
      <body>
        <title>Se enredó la cinta · Adivina la canción</title>
        <BrokenTapeScreen error={error} retry={retry} standalone />
      </body>
    </html>
  );
}
