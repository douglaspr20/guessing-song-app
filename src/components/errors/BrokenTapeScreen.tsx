"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/client";
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
  const { m } = useI18n();
  const e = m.common.errorPage;
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <ErrorScene
      code={e.code500}
      title={
        <>
          {e.brokenTitle}
          <br />
          <em>{e.brokenTitleEm}</em>
        </>
      }
      lede={e.brokenLede}
      actions={
        <>
          <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={() => retry()}>
            <RotateCcw size={26} aria-hidden />
            {e.rewind}
          </button>
          <Link href="/" className={`${ui.btn} ${ui.onShell} ${ui.big}`}>
            {m.common.backToShelf}
          </Link>
        </>
      }
      footnote={digest ? e.digest(digest) : undefined}
      art={<TangledTapeArt />}
      standalone={standalone}
    />
  );
}
