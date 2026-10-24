import { EyeOff } from "lucide-react";
import type { Game } from "@/lib/client/api";
import { TeamDot } from "@/components/TeamDot";
import { rulesFor } from "@/lib/game/scoring";
import { TEAM_COLORS } from "@/lib/game/teams";
import styles from "../game.module.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const seconds = (ms: number) => `${ms / 1000} s`;

/** Antes de la primera pista: resumen de la partida, reglas del modo y, con Spotify, aviso de spoiler. */
export function ReadyCard({ game }: { game: Game }) {
  const rules = rulesFor(game.mode);
  const [firstTier, secondTier] = rules.tierMs;
  const open = game.mode === "open";
  const byTeams = game.format === "teams";
  // Equipos en el orden de la paleta (el de creación), no por puntos.
  const teams = byTeams
    ? [...game.players].sort(
        (a, b) => TEAM_COLORS.findIndex((c) => c.key === a.color) - TEAM_COLORS.findIndex((c) => c.key === b.color),
      )
    : [];

  return (
    <div className={`${styles.revealCard} ${styles.readyCard}`}>
      <div>
        <p className={styles.revealTitle}>
          <span className={styles.revealEra}>Listo:</span>{" "}
          {byTeams
            ? `${plural(game.players.length, "equipo", "equipos")} · ${plural(game.players.reduce((n, p) => n + p.members.length, 0), "persona", "personas")},`
            : `${plural(game.players.length, "jugador", "jugadores")},`}{" "}
          {plural(game.totalRounds, "pista", "pistas")}
        </p>
        <p className={styles.revealResult}>
          {open ? "Cada vista previa suena" : "Cada canción suena"} {game.fragmentSeconds} s. El título vale 3, 2 o 1 punto
          si se acierta antes de los {seconds(firstTier)}, de los {seconds(secondTier)} o después; el artista suma 1 más si
          se dice antes de los {seconds(rules.hintAtMs.artist)}.
        </p>
        {byTeams && (
          <ul className={styles.readyTeams}>
            {teams.map((t) => (
              <li key={t.id}>
                <TeamDot color={t.color} size={16} /> <strong>{t.name}</strong>: {t.members.join(", ")}
              </li>
            ))}
          </ul>
        )}
        {!open && (
          <p className={styles.spoiler}>
            <EyeOff size={20} aria-hidden />
            Guarda los móviles con Spotify abierto en esta cuenta: muestran el título de lo que suena.
          </p>
        )}
      </div>
    </div>
  );
}
