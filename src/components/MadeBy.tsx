"use client";

import { useI18n } from "@/i18n/client";
import { AUTHOR } from "@/lib/site";
import styles from "./MadeBy.module.css";

/**
 * «Hecho por Douglas Pérez · Código en GitHub»: solo en la portada, la estantería y la pantalla final,
 * nunca durante el juego. Abre en otra pestaña para no sacar a nadie de su partida.
 */
export function MadeBy({ on = "shell", className }: { on?: "shell" | "card"; className?: string }) {
  const { m } = useI18n();
  const t = m.common;
  const newTab = <span className="sr-only"> {t.opensNewTab}</span>;
  return (
    <p className={`${styles.credit} ${on === "card" ? styles.onCard : ""} ${className ?? ""}`}>
      {t.madeBy}{" "}
      <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" className={styles.name}>
        {AUTHOR.name}
        {newTab}
      </a>
      <span aria-hidden> · </span>
      <a href={AUTHOR.repo} target="_blank" rel="noopener noreferrer">
        {t.sourceCode}
        {newTab}
      </a>
    </p>
  );
}
