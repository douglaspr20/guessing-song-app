"use client";

import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { AlertTriangle, Hand, Send } from "lucide-react";
import ui from "@/components/ui.module.css";
import { api, ApiError, type Round, errorText } from "@/lib/client/api";
import { useNow } from "@/app/partida/[id]/_lib/useGame";
import { fragmentEnded } from "@/lib/game/scoring";
import { useI18n } from "@/i18n/client";
import styles from "./play.module.css";

interface Props {
  gameId: string;
  round: Round;
  me: { id: string; lockedOut: boolean };
  /** Cuándo se leyó el estado (ms): el tiempo que queda se mide desde ahí. */
  fetchedAt: number;
  onChanged: () => Promise<unknown> | void;
}

interface Verdict {
  roundId: string;
  titleAwarded: boolean;
  artistAwarded: boolean;
  points: number;
}

/**
 * El mando durante una pista: el botón «¡Lo sé!» y, si te toca, los campos para responder con su
 * cuenta atrás. El servidor decide quién tiene el turno; aquí solo se explica por qué no se puede pulsar.
 */
export function BuzzerPad({ gameId, round, me, fetchedAt, onChanged }: Props) {
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
      <AnswerForm
        key={`${round.id}-${buzz.participantId}`}
        gameId={gameId}
        roundId={round.id}
        leftAtFetch={buzz.remainingMs}
        fetchedAt={fetchedAt}
        onVerdict={(v) => setVerdict({ roundId: round.id, ...v })}
        onChanged={onChanged}
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
    <div className={styles.pad}>
      {mineVerdict && !mineVerdict.titleAwarded && (
        <p className={`${ui.notice} ${ui.noticeErrorOnCard}`} role="status">
          <AlertTriangle size={20} aria-hidden />
          {mineVerdict.artistAwarded ? t.artistRight(mineVerdict.points) : ""}
          {t.wrongTitle}
        </p>
      )}
      <button type="button" className={styles.bigButton} onClick={buzzIn} disabled={!canBuzz} aria-describedby="buzz-note">
        <Hand size={56} aria-hidden />
        {t.buzz}
      </button>
      <p id="buzz-note" className={styles.padNote} role="status">
        {error ?? stateNote ?? t.pressWhenReady}
        {buzz && !mine && <Countdown leftAtFetch={buzz.remainingMs} fetchedAt={fetchedAt} />}
      </p>
    </div>
  );
}

function useLeftMs(leftAtFetch: number, fetchedAt: number) {
  const now = useNow(200);
  return now && fetchedAt ? Math.max(0, leftAtFetch - (now - fetchedAt)) : leftAtFetch;
}

function Countdown({ leftAtFetch, fetchedAt }: { leftAtFetch: number; fetchedAt: number }) {
  const left = useLeftMs(leftAtFetch, fetchedAt);
  return <span className={styles.padClock}> · {Math.ceil(left / 1000)} s</span>;
}

function AnswerForm({
  gameId,
  roundId,
  leftAtFetch,
  fetchedAt,
  onVerdict,
  onChanged,
}: {
  gameId: string;
  roundId: string;
  leftAtFetch: number;
  fetchedAt: number;
  onVerdict: (v: Omit<Verdict, "roundId">) => void;
  onChanged: () => Promise<unknown> | void;
}) {
  const { m } = useI18n();
  const t = m.play;
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(false);
  /** Se está escribiendo (el teclado ocupa media pantalla): el reloj se achica y se queda a la vista. */
  const [typing, setTyping] = useState(false);
  const left = useLeftMs(leftAtFetch, fetchedAt);
  const seconds = Math.ceil(left / 1000);
  // Lo último escrito, para enviarlo cuando se acabe el tiempo sin depender de cuándo se programó el aviso.
  const typed = useRef({ title, artist });
  useEffect(() => {
    typed.current = { title, artist };
  });

  const send = async () => {
    if (sent.current) return;
    sent.current = true;
    setBusy(true);
    try {
      const r = await api<Omit<Verdict, "roundId"> & { lockedOut: boolean }>(
        `/api/play/${gameId}/rounds/${roundId}/answer`,
        { json: typed.current },
      );
      onVerdict(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.cantSend);
    } finally {
      await onChanged();
    }
  };

  // Al acabarse el tiempo se envía lo que hubiera escrito (aunque sea nada).
  useEffect(() => {
    const t = setTimeout(() => void send(), leftAtFetch - (Date.now() - fetchedAt));
    return () => clearTimeout(t);
    // Se programa una vez por turno: el formulario se monta de nuevo con cada turno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  // Al salir el teclado, el campo tocado se sube a la vista (en iOS la página no se encoge sola).
  const reveal = (e: FocusEvent<HTMLInputElement>) => {
    const field = e.currentTarget;
    setTimeout(() => field.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  };

  return (
    <form
      className={styles.answerForm}
      data-typing={typing}
      onSubmit={submit}
      onFocus={() => setTyping(true)}
      onBlur={(e) => {
        // Pasar de un campo a otro no es dejar de escribir.
        if (!e.currentTarget.contains(e.relatedTarget)) setTyping(false);
      }}
      aria-label={t.yourAnswer}
    >
      <div className={styles.answerClock} data-urgent={seconds <= 5} role="timer" aria-live="off">
        <span>{seconds}</span>
        <small> s</small>
      </div>
      <p className={`${styles.padNote} ${styles.answerNote}`}>{t.turnNote}</p>
      <label className={styles.answerField}>
        <span>{t.song}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.songPlaceholder}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="next"
          onFocus={reveal}
          autoFocus
          disabled={busy}
          maxLength={200}
        />
      </label>
      <label className={styles.answerField}>
        <span>{t.artist}</span>
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder={t.artistPlaceholder}
          autoComplete="off"
          enterKeyHint="send"
          onFocus={reveal}
          disabled={busy}
          maxLength={200}
        />
      </label>
      {error && (
        <p className={`${ui.notice} ${ui.noticeErrorOnCard}`} role="alert">
          <AlertTriangle size={20} aria-hidden />
          {error}
        </p>
      )}
      <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.big} ${styles.sendBtn}`} disabled={busy}>
        <Send size={24} aria-hidden />
        {busy ? t.sending : t.send}
      </button>
    </form>
  );
}

