import Link from "next/link";
import type { ReactNode } from "react";
import { BandStatus } from "@/components/band/BandStatus";
import { ErrorScene } from "@/components/errors/ErrorScene";
import { LostTapeArt } from "@/components/errors/LostTapeArt";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
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
  return (
    <StageScreen>
      <p className={styles.stageLabel}>Rebobinando…</p>
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
  if (error.missing) {
    return (
      <ErrorScene
        code="Error 404"
        title={
          <>
            Este casete
            <br />
            <em>no está</em>
          </>
        }
        lede="No aparece en tu estantería. Puede que se haya borrado o que sea de otra persona."
        actions={
          <Link href="/" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
            Volver a la estantería
          </Link>
        }
        art={<LostTapeArt catalog="perdido" />}
      />
    );
  }
  return (
    <StageScreen>
      <RetryNotice message={`No se pudo abrir la partida. ${error.message}`} onRetry={onRetry} />
      <Link href="/" className={`${ui.btn} ${ui.onShell}`}>
        Volver a la estantería
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
  return (
    <StageScreen status={status} live>
      <p className={styles.stageLabel}>
        Pista {number} de {totalRounds}
      </p>
      <p key={secondsLeft} className={`${styles.countdown} ${styles.tick}`}>
        {secondsLeft}
      </p>
      <p className={styles.stageNote}>Silencio en la sala… la cinta está a punto de sonar.</p>
    </StageScreen>
  );
}
