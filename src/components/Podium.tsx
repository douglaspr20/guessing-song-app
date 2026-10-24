import { Crown } from "lucide-react";
import { memberLine } from "@/lib/game/teams";
import { TeamDot } from "./TeamDot";
import styles from "./Podium.module.css";

export interface PodiumEntry {
  id: string;
  name: string;
  score: number;
  /** Puesto (los empates comparten puesto). */
  place: number;
  /** Color y miembros, si es un equipo. */
  color?: string | null;
  members?: string[];
}

const ORDER = [1, 0, 2]; // 2º, 1º, 3º de izquierda a derecha

/** Podio de hasta tres jugadores. `grand` es la versión de final de partida. */
export function Podium({
  entries,
  size = "compact",
  animate = false,
  tone = "card",
}: {
  entries: PodiumEntry[];
  size?: "compact" | "grand";
  animate?: boolean;
  /** Sobre la carátula (tinta) o sobre la carcasa (papel). */
  tone?: "card" | "shell";
}) {
  const top = entries.slice(0, 3);
  // Sin puntos no hay a quién coronar.
  if (!top.length || top[0].score === 0) {
    return <p className={`${styles.none} ${styles[size]}`}>Aún sin puntos</p>;
  }
  return (
    <ol
      className={`${styles.podium} ${styles[size]} ${styles[tone]} ${animate ? styles.rise : ""}`}
      aria-label="Podio"
    >
      {ORDER.map((i) => {
        const e = top[i];
        const pos = i + 1;
        if (!e) return <li key={`empty-${pos}`} className={`${styles.slot} ${styles.empty}`} aria-hidden />;
        return (
          <li key={e.id} className={`${styles.slot} ${styles[`p${Math.min(e.place, 3)}`]} ${e.members?.length ? styles.team : ""}`}>
            {e.place === 1 && <Crown className={styles.crown} size={size === "grand" ? 44 : 22} strokeWidth={2.5} aria-hidden />}
            <span className={styles.name}>
              <TeamDot color={e.color} size={size === "grand" ? 20 : 12} /> {e.name}
            </span>
            {size === "grand" && !!e.members?.length && <span className={styles.members}>{memberLine(e.members, 4)}</span>}
            <span className={styles.score}>
              {e.score} <span className="sr-only">puntos</span>
            </span>
            <span className={styles.step} aria-label={`Puesto ${e.place}`}>
              {e.place}º
            </span>
          </li>
        );
      })}
    </ol>
  );
}
