"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { LocaleSwitch } from "./LocaleSwitch";
import styles from "./TopBar.module.css";

/** Cabecera con las rayas de la cinta: la marca a la izquierda; la etiqueta de estado y el idioma a la derecha. */
export function TopBar({ status }: { status?: ReactNode }) {
  const { m } = useI18n();
  return (
    <header className={styles.bar}>
      <Link href="/" className={`${styles.tag} ${styles.brand}`}>
        {/* El mismo casete que el favicon (src/app/icon.svg): un SVG fijo y pequeño, no necesita next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className={styles.brandIcon} />
        {m.common.brand}
      </Link>
      <div className={styles.end}>
        {status && <span className={`${styles.tag} ${styles.status}`}>{status}</span>}
        <LocaleSwitch />
      </div>
    </header>
  );
}
