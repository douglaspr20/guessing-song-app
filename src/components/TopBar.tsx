import Link from "next/link";
import type { ReactNode } from "react";
import { CassetteTape } from "lucide-react";
import styles from "./TopBar.module.css";

/** Cabecera con las rayas de la cinta: la marca a la izquierda y una etiqueta de estado a la derecha. */
export function TopBar({ status }: { status?: ReactNode }) {
  return (
    <header className={styles.bar}>
      <Link href="/" className={`${styles.tag} ${styles.brand}`}>
        <CassetteTape size={26} strokeWidth={2.5} aria-hidden />
        Adivina la canción
      </Link>
      {status && <span className={`${styles.tag} ${styles.status}`}>{status}</span>}
    </header>
  );
}
