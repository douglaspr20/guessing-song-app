"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import ui from "../ui.module.css";
import { ErrorScene } from "./ErrorScene";
import { TangledTapeArt } from "./TangledTapeArt";

/**
 * Algo se rompió al pintar la pantalla. Nunca muestra el detalle técnico: solo el código para
 * buscarlo en los logs del servidor, si lo hay.
 */
export function BrokenTapeScreen({
  error,
  retry,
  standalone = false,
}: {
  error: unknown;
  retry: () => void;
  /** Sin layout raíz (global-error): la escena trae su propia banda. */
  standalone?: boolean;
}) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <ErrorScene
      code="Error 500"
      title={
        <>
          Se enredó
          <br />
          <em>la cinta</em>
        </>
      }
      lede="Algo se trabó al reproducir esta pantalla. Dale unas vueltas con el lápiz y prueba otra vez: casi siempre vuelve a sonar."
      actions={
        <>
          <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={() => retry()}>
            <RotateCcw size={26} aria-hidden />
            Rebobinar
          </button>
          <Link href="/" className={`${ui.btn} ${ui.onShell} ${ui.big}`}>
            Volver a la estantería
          </Link>
        </>
      }
      footnote={digest ? `Código del error: ${digest}` : undefined}
      art={<TangledTapeArt />}
      standalone={standalone}
    />
  );
}
