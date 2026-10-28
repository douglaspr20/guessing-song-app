import { EyeOff } from "lucide-react";
import type { Game } from "@/lib/client/api";
import { TeamDot } from "@/components/TeamDot";
import { rulesFor } from "@/lib/game/scoring";
import { byPalette } from "@/lib/game/standings";
import { plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

const seconds = (ms: number) => `${ms / 1000} s`;

/** Antes de la primera pista: resumen de la partida, reglas del modo y, con Spotify, aviso de spoiler. */
export function ReadyCard({ game }: { game: Game }) {
  const { m, locale } = useI18n();
  const g = m.game;
  const rules = rulesFor(game.mode);
  const [firstTier, secondTier] = rules.tierMs;
  const open = game.mode === "open";
  const byTeams = game.format === "teams";
  // Equipos en el orden de la paleta (el de creación), no por puntos.
  const teams = byTeams ? [...game.players].sort(byPalette) : [];

  return (
    <div className={`${styles.revealCard} ${styles.readyCard}`}>
      <div>
        <p className={styles.revealTitle}>
          <span className={styles.revealEra}>{g.ready}</span>{" "}
          {byTeams
            ? `${plural(locale, game.players.length, g.teams)} · ${plural(locale, game.players.reduce((n, p) => n + p.members.length, 0), g.people)},`
            : `${plural(locale, game.players.length, g.players)},`}{" "}
          {plural(locale, game.totalRounds, g.tracks)}
        </p>
        <p className={styles.revealResult}>
          {(open ? g.rulesOpen : g.rulesSpotify)(
            game.fragmentSeconds,
            seconds(firstTier),
            seconds(secondTier),
            seconds(rules.hintAtMs.artist),
          )}
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
            {g.spoiler}
          </p>
        )}
      </div>
    </div>
  );
}
