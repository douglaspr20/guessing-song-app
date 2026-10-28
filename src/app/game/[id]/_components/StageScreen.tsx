"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BandStatus } from "@/components/band/BandStatus";
import { ErrorScene } from "@/components/errors/ErrorScene";
import { LostTapeArt } from "@/components/errors/LostTapeArt";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

/** Pantalla de un solo mensaje centrado, con la cabecera de rayas. */
export function StageScreen({ status, live, children }: { status?: string; live?: boolean; children: ReactNode }) {
  return (
    <>
      <BandStatus text={status} />
      <main className={styles.main}>
        <div className={styles.stage} aria-live={live ? "assertive" : undefined}>
          <div className={styles.stageInner}>{children}</div>
        </div>
      </main>
    </>
  );
}

export function LoadingScreen() {
  const { m } = useI18n();
  return (
    <StageScreen>
      <p className={styles.stageLabel}>{m.common.loading}</p>
    </StageScreen>
  );
}

/** No se pudo abrir la partida: si no existe, el cartel de «Se busca»; si falló la conexión, reintentar. */
export function LoadErrorScreen({
  error,
  onRetry,
}: {
  error: { missing: boolean; message: string };
  onRetry: () => Promise<unknown>;
}) {
  const { m } = useI18n();
  const g = m.game;
  if (error.missing) {
    return (
      <ErrorScene
        code={m.common.errorPage.code404}
        title={
          <>
            {g.notFoundTitle}
            <br />
            <em>{g.notFoundTitleEm}</em>
          </>
        }
        lede={g.notFoundLede}
        actions={
          <Link href="/" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
            {m.common.backToShelf}
          </Link>
        }
        art={<LostTapeArt catalog={g.lostCatalog} />}
      />
    );
  }
  return (
    <StageScreen>
      <RetryNotice message={g.cantOpen(error.message)} onRetry={onRetry} />
      <Link href="/" className={`${ui.btn} ${ui.onShell}`}>
        {m.common.backToShelf}
      </Link>
    </StageScreen>
  );
}

/** Cuenta atrás de 3 s entre rondas: deja a la sala en silencio antes de que suene la cinta. */
export function IntermissionScreen({
  status,
  number,
  totalRounds,
  secondsLeft,
}: {
  status: string;
  number: number;
  totalRounds: number;
  secondsLeft: number;
}) {
  const { m } = useI18n();
  return (
    <StageScreen status={status} live>
      <p className={styles.stageLabel}>
        {m.game.trackOf(number, totalRounds)}
      </p>
      <p key={secondsLeft} className={`${styles.countdown} ${styles.tick}`}>
        {secondsLeft}
      </p>
      <p className={styles.stageNote}>{m.game.intermissionNote}</p>
    </StageScreen>
  );
}
