"use client";

import { Check, Smartphone, X } from "lucide-react";
import ui from "@/components/ui.module.css";
import type { GuessRow, Round } from "@/lib/client/api";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

/**
 * Intentos de la ronda, con «Dar por bueno» para lo que el comparador rechazó.
 * Se despliega solo cuando la ronda está cerrada.
 */
export function AttemptsList({
  round,
  guesses,
  open,
  artistDeadlineMs,
  busy,
  onAccept,
}: {
  round: Round;
  guesses: GuessRow[];
  open: boolean;
  /** Hasta cuándo (ms de ronda) un artista dicho aún puede darse por bueno. */
  artistDeadlineMs: number;
  busy: boolean;
  onAccept: (guess: GuessRow, part: "title" | "artist") => void;
}) {
  const { m } = useI18n();
  const g = m.game;
  if (!guesses.length) return null;
  return (
    <details className={`${ui.card} ${styles.attempts}`} open={!open}>
      <summary>{g.attempts(guesses.length)}</summary>
      <ol className={styles.attemptList}>
        {guesses.map((row) => (
          <li key={row.id} className={styles.attempt}>
            <span className={styles.attemptAt}>{Math.floor(row.atMs / 1000)} s</span>
            <div className={styles.attemptBody}>
              <span className={styles.attemptWho}>
                {row.playerName}
                {row.viaPhone && <Smartphone className={styles.viaPhone} size={18} aria-label={g.viaPhone} />}
              </span>
              {(row.title || row.titleCorrect) && (
                <AttemptPart
                  correct={row.titleCorrect}
                  label={row.title ? g.quoted(row.title) : g.songSpoken}
                  canAccept={!row.titleCorrect && !round.winnerPlayerId}
                  busy={busy}
                  onAccept={() => onAccept(row, "title")}
                />
              )}
              {(row.artist || row.artistCorrect) && (
                <AttemptPart
                  correct={row.artistCorrect}
                  label={row.artist ? g.artistQuoted(row.artist) : g.artistSpoken}
                  canAccept={!row.artistCorrect && !round.artistWinnerPlayerId && row.atMs < artistDeadlineMs}
                  busy={busy}
                  onAccept={() => onAccept(row, "artist")}
                />
              )}
              {row.points > 0 && <span className={styles.attemptPts}>+{row.points}</span>}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function AttemptPart({
  correct,
  label,
  canAccept,
  busy,
  onAccept,
}: {
  correct: boolean;
  label: string;
  canAccept: boolean;
  busy: boolean;
  onAccept: () => void;
}) {
  const { m } = useI18n();
  return (
    <span className={styles.attemptPart}>
      {correct ? (
        <Check className={styles.ok} size={20} aria-label={m.game.right} />
      ) : (
        <X className={styles.no} size={20} aria-label={m.game.wrong} />
      )}
      {label}
      {canAccept && (
        <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.accept}`} onClick={onAccept} disabled={busy}>
          {m.game.accept}
        </button>
      )}
    </span>
  );
}
