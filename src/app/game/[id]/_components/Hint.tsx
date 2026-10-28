"use client";

import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

export type RemoteColor = "red" | "green" | "yellow" | "blue";

/** Marca del atajo dentro de un botón: la tecla y, si lo tiene, el botón de color del mando de la tele. */
export function Hint({ k, color }: { k: string; color?: RemoteColor }) {
  const { m } = useI18n();
  return (
    <span className={styles.hint}>
      {color && <span className={styles.remoteDot} data-color={color} title={m.game.remoteButton(m.game.remoteColors[color])} />}
      <kbd className={styles.key}>{k === "space" ? m.game.keySpace : k}</kbd>
    </span>
  );
}
