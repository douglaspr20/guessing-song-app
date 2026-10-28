"use client";

import { useI18n } from "@/i18n/client";
import styles from "../result.module.css";

/** Mientras se lee el resultado. */
export function ResultLoading() {
  const { m } = useI18n();
  return (
    <main className={styles.main}>
      <p>{m.common.loading}</p>
    </main>
  );
}
