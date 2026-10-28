"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { MadeBy } from "@/components/MadeBy";
import { Notice } from "@/components/Notice";
import { ShareResult } from "@/components/ShareResult";
import { Podium } from "@/components/Podium";
import { TapeConfetti } from "@/components/TapeConfetti";
import { TeamDot } from "@/components/TeamDot";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { api, catalogLabel, type Game, type Player } from "@/lib/client/api";
import { winnerSummary, withPlaces } from "@/lib/game/standings";
import { formatDate, formatList, plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

/** Fin de la partida: la carátula se cierra con el podio, el ganador y confeti si alguien sumó. */
export function Finale({ game }: { game: Game }) {
  const { m, locale } = useI18n();
  const g = m.game;
  const players = game.players;
  const entries = withPlaces(players);
  const nobody = winnerSummary(players).kind === "none";
  const cat = catalogLabel(game.catalogNumber);
  const router = useRouter();
  const replay = useAsyncAction();
  /** «Otra igual»: la misma partida con las mismas personas; los móviles unidos pasan a ella solos. */
  const repeat = async () => {
    const next = await replay.run(() => api<Game>(`/api/games/${game.id}/replay`, { method: "POST" }));
    if (next) router.push(`/game/${next.id}`);
  };

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
                  <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={repeat} disabled={replay.busy}>
                    <RotateCcw size={26} aria-hidden />
                    {replay.busy ? g.sameAgainBusy : g.sameAgain}
                  </button>
                  <Link href="/new" className={`${ui.btn} ${ui.onCard}`}>
                    {g.recordAnother}
                  </Link>
                  <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
                    {m.common.backToShelf}
                  </Link>
                  <ShareResult gameId={game.id} who="host" />
                </div>
                {replay.error && (
                  <Notice on="card" className={styles.finaleCredit}>
                    {replay.error}
                  </Notice>
                )}
                <MadeBy on="card" className={styles.finaleCredit} />
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
  const result = winnerSummary(players);
  if (result.kind === "none") return <>{g.nobodyScored}</>;
  if (result.kind === "tie") {
    return (
      <>
        {g.tieBetween} <span className={styles.finaleName}>{formatList(locale, result.names)}</span>
      </>
    );
  }
  return (
    <>
      {g.won} <span className={styles.finaleName}>{result.name}</span>
    </>
  );
}
