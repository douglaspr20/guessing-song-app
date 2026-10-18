import type { Game, Round } from "@/lib/client/api";
import styles from "../game.module.css";

/** Ronda cerrada: portada, título, artista y quién la acertó. */
export function RevealCard({ game, round }: { game: Game; round: Round }) {
  const answer = round.answer;
  if (!answer) return null;
  return (
    <div className={styles.revealCard}>
      {answer.albumImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.cover} src={answer.albumImage} alt="" />
      ) : (
        <div className={styles.cover} />
      )}
      <div>
        <p className={styles.revealTitle}>
          <span className={styles.revealEra}>Era</span> {answer.name}
        </p>
        <p className={styles.revealArtist}>{answer.artists.join(", ")}</p>
        <p className={styles.revealResult}>
          <WinnersLine game={game} round={round} />
        </p>
      </div>
    </div>
  );
}

function WinnersLine({ game, round }: { game: Game; round: Round }) {
  const nameOf = (id: string | null) => game.players.find((p) => p.id === id)?.name;
  const winner = nameOf(round.winnerPlayerId);
  const artistWinner = nameOf(round.artistWinnerPlayerId);
  const artistPart = artistWinner && (
    <>
      el artista lo dijo <strong>{artistWinner}</strong>
    </>
  );

  if (winner) {
    return (
      <>
        La adivinó <strong>{winner}</strong>
        {artistPart && <> · {artistPart}</>}
      </>
    );
  }
  if (artistPart) return <>Nadie dijo la canción · {artistPart}</>;
  return <>Nadie la adivinó esta vez.</>;
}
