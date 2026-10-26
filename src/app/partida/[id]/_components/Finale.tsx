"use client";

import Link from "next/link";
import { Podium } from "@/components/Podium";
import { TapeConfetti } from "@/components/TapeConfetti";
import { TeamDot } from "@/components/TeamDot";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import { catalogLabel, type Game, type Player } from "@/lib/client/api";
import { formatDate, formatList, plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

/** Fin de la partida: la carátula se cierra con el podio, el ganador y confeti si alguien sumó. */
export function Finale({ game }: { game: Game }) {
  const { m, locale } = useI18n();
  const g = m.game;
  const players = game.players;
  const entries = players.map((p) => ({ ...p, place: players.findIndex((q) => q.score === p.score) + 1 }));
  const top = players[0];
  const nobody = !top || top.score === 0;
  const cat = catalogLabel(game.catalogNumber);

  return (
    <>
      {!nobody && <TapeConfetti />}
      <BandStatus text={`${cat} · ${g.endOfTape}`} />
      <main className={styles.main}>
        <section className={`${ui.card} ${styles.finale}`} aria-live="polite">
          <div className={styles.finaleBand}>
            <span className={styles.finaleTag}>{cat}</span>
            <span className={styles.finaleTag}>
              {plural(locale, game.totalRounds, g.tracks)} · {formatDate(locale, game.createdAt)}
            </span>
          </div>
          <div className={styles.finaleBody}>
            <h1 className={styles.finaleTitle}>
              <WinnerTitle players={players} />
            </h1>
            <div className={`${styles.finaleGrid} ${game.format === "teams" ? styles.finaleTeams : ""}`}>
              <div className={styles.finalePodium}>
                <Podium entries={entries} size="grand" animate tone="card" />
              </div>
              <div className={styles.finaleSide}>
                {entries.length > 3 && (
                  <ol className={styles.restList} aria-label={g.restOfScoreboard}>
                    {entries.slice(3).map((p) => (
                      <li key={p.id}>
                        <span className={styles.restPos}>{p.place}</span>
                        <span className={styles.restName}>
                          <TeamDot color={p.color} size={16} /> {p.name}
                        </span>
                        <span className={styles.restPts}>{p.score}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className={styles.finaleActions}>
                  <Link href="/nueva" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
                    {g.recordAnother}
                  </Link>
                  <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
                    {m.common.backToShelf}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function WinnerTitle({ players }: { players: Player[] }) {
  const { m, locale } = useI18n();
  const g = m.game;
  const top = players[0];
  if (!top || top.score === 0) return <>{g.nobodyScored}</>;
  const tied = players.filter((p) => p.score === top.score);
  if (tied.length > 1) {
    return (
      <>
        {g.tieBetween} <span className={styles.finaleName}>{formatList(locale, tied.map((p) => p.name))}</span>
      </>
    );
  }
  return (
    <>
      {g.won} <span className={styles.finaleName}>{top.name}</span>
    </>
  );
}
