import type { CSSProperties, ReactNode } from "react";
import { formatClock } from "@/lib/client/api";
import styles from "./Cassette.module.css";

export interface HintMark {
  key: string;
  label: string;
  at: string;
  /** Valor ya desbloqueado (o null si aún no). */
  value: string | null;
  unlocked: boolean;
}

/**
 * La carcasa del casete: etiqueta, ventana con las dos bobinas y el contador de cuenta atrás,
 * y las marcas de pista. La cinta pasa de la bobina izquierda a la derecha según `progress`.
 */
export function Cassette({
  title,
  value,
  remainingMs,
  progress,
  running,
  caption,
  hints,
}: {
  title: ReactNode;
  value: ReactNode;
  remainingMs: number;
  /** 0 al empezar el fragmento, 1 al acabar. */
  progress: number;
  running: boolean;
  caption: string;
  hints: HintMark[];
}) {
  const p = Math.min(1, Math.max(0, progress));
  // Radio relativo del rollo de cinta en cada bobina (entre el eje y el borde).
  const left = 62 + (1 - p) * 38;
  const right = 62 + p * 38;
  const low = running && remainingMs <= 10_000;

  return (
    <section className={styles.shell} aria-label="Casete de la pista">
      <div className={styles.label}>
        <span className={styles.labelTitle}>{title}</span>
        <span className={styles.labelValue}>{value}</span>
      </div>

      <div className={`${styles.window} ${running ? styles.running : ""} ${low ? styles.low : ""}`}>
        <div className={styles.windowInner}>
          <div className={styles.reel} aria-hidden>
            <span className={styles.tape} style={{ "--r": `${left}%` } as CSSProperties} />
            <span className={styles.hub} />
          </div>
          <div className={styles.counter} role="timer" aria-live="off">
            <span className={styles.digits}>{formatClock(remainingMs)}</span>
            <span className={styles.caption}>{caption}</span>
          </div>
          <div className={styles.reel} aria-hidden>
            <span className={styles.tape} style={{ "--r": `${right}%` } as CSSProperties} />
            <span className={styles.hub} />
          </div>
        </div>
      </div>

      <ol className={styles.marks} aria-label="Pistas">
        {hints.map((h) => (
          <li key={h.key} className={`${styles.mark} ${h.unlocked ? styles.markOn : ""}`}>
            {h.at} · {h.label}
            <strong>{h.unlocked ? (h.value ?? "no disponible") : "—"}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}
