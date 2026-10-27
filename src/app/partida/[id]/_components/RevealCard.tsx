"use client";

import type { Game, Round } from "@/lib/client/api";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

/** Ronda cerrada: portada, título, artista y quién la acertó. */
export function RevealCard({ game, round }: { game: Game; round: Round }) {
  const { m } = useI18n();
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
          <span className={styles.revealEra}>{m.game.itWas}</span> {answer.name}
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
  const { m } = useI18n();
  const g = m.game;
  const nameOf = (id: string | null) => game.players.find((p) => p.id === id)?.name;
  const winner = nameOf(round.winnerPlayerId);
  const artistWinner = nameOf(round.artistWinnerPlayerId);
  const artistPart = artistWinner && (
    <>
      {g.artistSaidBy} <strong>{artistWinner}</strong>
    </>
  );

  if (winner) {
    return (
      <>
        {g.guessedBy} <strong>{winner}</strong>
        {artistPart && <> · {artistPart}</>}
      </>
    );
  }
  if (artistPart) return <>{g.nobodySaidSong} · {artistPart}</>;
  return <>{g.nobodyGuessed}</>;
}
