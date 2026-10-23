import { useId, type ReactNode } from "react";
import ui from "@/components/ui.module.css";
import styles from "../host.module.css";

/** Carátula de una sección del panel: tapa de rayas y título. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={ui.card} aria-labelledby={id}>
      <div className={ui.cardStripes} />
      <div className={styles.section}>
        <h2 className={styles.h} id={id}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
