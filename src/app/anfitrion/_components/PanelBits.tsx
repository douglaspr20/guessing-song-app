import { useId, type ReactNode } from "react";
import { Card } from "@/components/Card";
import styles from "../host.module.css";

/** Carátula de una sección del panel: tapa de rayas y título. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <Card aria-labelledby={id}>
      <div className={styles.section}>
        <h2 className={styles.h} id={id}>
          {title}
        </h2>
        {children}
      </div>
    </Card>
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

/** Fila de una lista del panel: título y detalle a la izquierda, botones a la derecha y, si hace falta, algo debajo. */
export function ListItem({
  title,
  meta,
  actions,
  below,
}: {
  title: ReactNode;
  meta: ReactNode;
  actions?: ReactNode;
  below?: ReactNode;
}) {
  return (
    <li className={styles.item}>
      <span className={styles.itemMain}>
        <span className={styles.itemTitle}>{title}</span>
        <span className={styles.itemMeta}>{meta}</span>
      </span>
      {actions && <span className={styles.row}>{actions}</span>}
      {below}
    </li>
  );
}

/** Un secreto que se enseña una sola vez (código de invitación, contraseña temporal): cópialo ahora. */
export function RevealedSecret({
  label,
  value,
  note,
  fullRow = false,
}: {
  label: string;
  value: string;
  note?: ReactNode;
  /** Ocupa toda la fila de su elemento (debajo de sus botones). */
  fullRow?: boolean;
}) {
  return (
    <div className={`${styles.newCode} ${fullRow ? styles.fullRow : ""}`} role="status">
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.codeValue}>{value}</span>
      {note && <span className={styles.itemMeta}>{note}</span>}
    </div>
  );
}
