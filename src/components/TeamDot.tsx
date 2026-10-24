import { teamColor } from "@/lib/game/teams";
import styles from "./TeamDot.module.css";

/** Muestrario del color de un equipo: círculo relleno con trazo de tinta. No dice nada a un lector de pantalla. */
export function TeamDot({ color, size = 14 }: { color: string | null | undefined; size?: number }) {
  const hex = teamColor(color)?.hex;
  if (!hex) return null;
  return <span className={styles.dot} style={{ background: hex, width: size, height: size }} aria-hidden />;
}
