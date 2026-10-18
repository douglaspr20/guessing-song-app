import { Check, X } from "lucide-react";
import ui from "@/components/ui.module.css";
import type { GuessRow, Round } from "@/lib/client/api";
import { ARTIST_DEADLINE_MS } from "../_lib/constants";
import styles from "../game.module.css";

/**
 * Intentos de la ronda, con «Dar por bueno» para lo que el comparador rechazó.
 * Se despliega solo cuando la ronda está cerrada.
 */
export function AttemptsList({
  round,
  guesses,
  open,
  busy,
  onAccept,
}: {
  round: Round;
  guesses: GuessRow[];
  open: boolean;
  busy: boolean;
  onAccept: (guess: GuessRow, part: "title" | "artist") => void;
}) {
  if (!guesses.length) return null;
  return (
    <details className={`${ui.card} ${styles.attempts}`} open={!open}>
      <summary>Intentos de esta pista · {guesses.length}</summary>
      <ol className={styles.attemptList}>
        {guesses.map((g) => (
          <li key={g.id} className={styles.attempt}>
            <span className={styles.attemptAt}>{Math.floor(g.atMs / 1000)} s</span>
            <div className={styles.attemptBody}>
              <span className={styles.attemptWho}>{g.playerName}</span>
              {g.title && (
                <AttemptPart
                  correct={g.titleCorrect}
                  label={`«${g.title}»`}
                  canAccept={!g.titleCorrect && !round.winnerPlayerId}
                  busy={busy}
                  onAccept={() => onAccept(g, "title")}
                />
              )}
              {g.artist && (
                <AttemptPart
                  correct={g.artistCorrect}
                  label={`artista «${g.artist}»`}
                  canAccept={!g.artistCorrect && !round.artistWinnerPlayerId && g.atMs < ARTIST_DEADLINE_MS}
                  busy={busy}
                  onAccept={() => onAccept(g, "artist")}
                />
              )}
              {g.points > 0 && <span className={styles.attemptPts}>+{g.points}</span>}
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
  return (
    <span className={styles.attemptPart}>
      {correct ? (
        <Check className={styles.ok} size={20} aria-label="bien" />
      ) : (
        <X className={styles.no} size={20} aria-label="mal" />
      )}
      {label}
      {canAccept && (
        <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.accept}`} onClick={onAccept} disabled={busy}>
          Dar por bueno
        </button>
      )}
    </span>
  );
}
