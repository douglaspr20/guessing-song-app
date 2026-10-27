"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CassetteTape } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LocaleSwitch } from "./LocaleSwitch";
import styles from "./TopBar.module.css";

/** Cabecera con las rayas de la cinta: la marca a la izquierda; la etiqueta de estado y el idioma a la derecha. */
export function TopBar({ status }: { status?: ReactNode }) {
  const { m } = useI18n();
  return (
    <header className={styles.bar}>
      <Link href="/" className={`${styles.tag} ${styles.brand}`}>
        <CassetteTape size={26} strokeWidth={2.5} aria-hidden />
        {m.common.brand}
      </Link>
      <div className={styles.end}>
        {status && <span className={`${styles.tag} ${styles.status}`}>{status}</span>}
        <LocaleSwitch />
      </div>
    </header>
  );
}
