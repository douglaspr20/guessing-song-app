import { EyeOff } from "lucide-react";
import type { Game } from "@/lib/client/api";
import styles from "../game.module.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Antes de la primera pista: resumen de la partida, reglas y aviso de spoiler. */
export function ReadyCard({ game }: { game: Game }) {
  return (
    <div className={`${styles.revealCard} ${styles.readyCard}`}>
      <div>
        <p className={styles.revealTitle}>
          <span className={styles.revealEra}>Listo:</span> {plural(game.players.length, "jugador", "jugadores")},{" "}
          {plural(game.totalRounds, "pista", "pistas")}
        </p>
        <p className={styles.revealResult}>
          Cada canción suena {game.fragmentSeconds} s. El título vale 3, 2 o 1 punto según lo rápido que se acierte; el
          artista suma 1 más si se dice antes de los 40 s.
        </p>
        <p className={styles.spoiler}>
          <EyeOff size={20} aria-hidden />
          Guarda los móviles con Spotify abierto en esta cuenta: muestran el título de lo que suena.
        </p>
      </div>
    </div>
  );
}
