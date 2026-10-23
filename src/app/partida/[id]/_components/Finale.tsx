import Link from "next/link";
import { Podium } from "@/components/Podium";
import { TapeConfetti } from "@/components/TapeConfetti";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import { catalogLabel, formatDate, type Game, type Player } from "@/lib/client/api";
import styles from "../game.module.css";

/** Fin de la partida: la carátula se cierra con el podio, el ganador y confeti si alguien sumó. */
export function Finale({ game }: { game: Game }) {
  const players = game.players;
  const entries = players.map((p) => ({ ...p, place: players.findIndex((q) => q.score === p.score) + 1 }));
  const top = players[0];
  const nobody = !top || top.score === 0;
  const cat = catalogLabel(game.catalogNumber);

  return (
    <>
      {!nobody && <TapeConfetti />}
      <BandStatus text={`${cat} · Fin de la cinta`} />
      <main className={styles.main}>
        <section className={`${ui.card} ${styles.finale}`} aria-live="polite">
          <div className={styles.finaleBand}>
            <span className={styles.finaleTag}>{cat}</span>
            <span className={styles.finaleTag}>
              {game.totalRounds} {game.totalRounds === 1 ? "pista" : "pistas"} · {formatDate(game.createdAt)}
            </span>
          </div>
          <div className={styles.finaleBody}>
            <h1 className={styles.finaleTitle}>
              <WinnerTitle players={players} />
            </h1>
            <div className={styles.finaleGrid}>
              <div className={styles.finalePodium}>
                <Podium entries={entries} size="grand" animate tone="card" />
              </div>
              <div className={styles.finaleSide}>
                {entries.length > 3 && (
                  <ol className={styles.restList} aria-label="Resto del marcador">
                    {entries.slice(3).map((p) => (
                      <li key={p.id}>
                        <span className={styles.restPos}>{p.place}</span>
                        <span className={styles.restName}>{p.name}</span>
                        <span className={styles.restPts}>{p.score}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className={styles.finaleActions}>
                  <Link href="/nueva" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
                    Grabar otra partida
                  </Link>
                  <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
                    Volver a la estantería
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
  const top = players[0];
  if (!top || top.score === 0) return <>Nadie sumó puntos</>;
  const tied = players.filter((p) => p.score === top.score);
  if (tied.length > 1) {
    return (
      <>
        Empate entre <span className={styles.finaleName}>{tied.map((p) => p.name).join(" y ")}</span>
      </>
    );
  }
  return (
    <>
      Ganó <span className={styles.finaleName}>{top.name}</span>
    </>
  );
}
