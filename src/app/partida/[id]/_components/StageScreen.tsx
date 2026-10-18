import Link from "next/link";
import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import ui from "@/components/ui.module.css";
import styles from "../game.module.css";

/** Pantalla de un solo mensaje centrado, con la cabecera de rayas. */
export function StageScreen({ status, live, children }: { status?: string; live?: boolean; children: ReactNode }) {
  return (
    <>
      <TopBar status={status} />
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

export function LoadErrorScreen({ message }: { message: string }) {
  return (
    <StageScreen>
      <p className={styles.stageTitle}>{message}</p>
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
