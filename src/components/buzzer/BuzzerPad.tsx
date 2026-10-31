"use client";

import { useState, type ReactNode } from "react";
import { Hand } from "lucide-react";
import { Notice } from "@/components/Notice";
import { api, errorText, type Round } from "@/lib/client/api";
import { useRemainingMs } from "@/hooks/useNow";
import { BuzzAnswerForm, type Verdict } from "./BuzzAnswerForm";
import { fragmentEnded } from "@/lib/game/scoring";
import { useI18n } from "@/i18n/client";
import styles from "./Buzzer.module.css";

interface Props {
  gameId: string;
  round: Round;
  me: { id: string; lockedOut: boolean };
  /** Cuándo se leyó el estado (ms): el tiempo que queda se mide desde ahí. */
  fetchedAt: number;
  onChanged: () => Promise<unknown> | void;
  /** Las pistas ya desbloqueadas: arriba del botón, o bajo el reloj al responder. */
  hints?: ReactNode;
  /** En la pantalla del anfitrión: una franja en vez de medio alto de pantalla (allí manda el casete). */
  compact?: boolean;
}

/**
 * El mando durante una pista: el botón «¡Lo sé!» y, si te toca, los campos para responder con su
 * cuenta atrás. El servidor decide quién tiene el turno; aquí solo se explica por qué no se puede pulsar.
 */
export function BuzzerPad({ gameId, round, me, fetchedAt, onChanged, hints, compact = false }: Props) {
  const { m } = useI18n();
  const t = m.play;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const buzz = round.buzz;
  const mine = buzz?.participantId === me.id;

  const buzzIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/play/${gameId}/rounds/${round.id}/buzz`, { method: "POST" });
      navigator.vibrate?.(60);
    } catch (e) {
      setError(errorText(e));
    } finally {
      await onChanged();
      setBusy(false);
    }
  };

  if (mine && buzz) {
    return (
      <BuzzAnswerForm
        key={`${round.id}-${buzz.participantId}`}
        gameId={gameId}
        roundId={round.id}
        leftAtFetch={buzz.remainingMs}
        fetchedAt={fetchedAt}
        onVerdict={(v) => setVerdict({ roundId: round.id, ...v })}
        onChanged={onChanged}
        hints={hints}
      />
    );
  }

  const stateNote = (() => {
    if (buzz) return t.hasTurn(buzz.name || t.someone);
    if (me.lockedOut) return t.lockedOut;
    if (!round.playStartedAt) return t.notPlayingYet;
    if (round.paused) {
      // La tele congela la ronda al acabarse el audio: no es una pausa del anfitrión, es que ya no suena.
      return fragmentEnded(round)
        ? t.fragmentEnded
        : t.hostPaused;
    }
    return null;
  })();
  const canBuzz = !stateNote && !busy;
  const mineVerdict = verdict?.roundId === round.id ? verdict : null;

  return (
    <div className={`${styles.pad} ${compact ? styles.compact : ""}`}>
      {hints}
      {mineVerdict && !mineVerdict.titleAwarded && (
        <Notice role="status">
          {mineVerdict.artistAwarded ? t.artistRight(mineVerdict.points) : ""}
          {t.wrongTitle}
        </Notice>
      )}
      <button type="button" className={styles.bigButton} onClick={buzzIn} disabled={!canBuzz} aria-describedby="buzz-note">
        <Hand size={compact ? 40 : 56} aria-hidden />
        {t.buzz}
      </button>
      <p id="buzz-note" className={styles.padNote} role="status">
        {error ?? stateNote ?? t.pressWhenReady}
        {buzz && !mine && <Countdown leftAtFetch={buzz.remainingMs} fetchedAt={fetchedAt} />}
      </p>
    </div>
  );
}

/** Cuánto le queda a quien tiene el turno (lo ven los demás móviles). */
function Countdown({ leftAtFetch, fetchedAt }: { leftAtFetch: number; fetchedAt: number }) {
  const left = useRemainingMs(leftAtFetch, fetchedAt);
  return <span className={styles.padClock}> · {Math.ceil(left / 1000)} s</span>;
}
