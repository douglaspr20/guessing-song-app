"use client";

import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { AlertTriangle, Hand, Send } from "lucide-react";
import ui from "@/components/ui.module.css";
import { api, ApiError, type Round } from "@/lib/client/api";
import { useNow } from "@/app/partida/[id]/_lib/useGame";
import { fragmentEnded } from "@/lib/game/scoring";
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
      setError(e instanceof ApiError ? e.message : "No se pudo conectar. Prueba otra vez.");
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
    if (buzz) return `${buzz.name || "Alguien"} tiene el turno`;
    if (me.lockedOut) return "Fallaste en esta pista: espera a la siguiente";
    if (!round.playStartedAt) return "Aún no suena";
    if (round.paused) {
      // La tele congela la ronda al acabarse el audio: no es una pausa del anfitrión, es que ya no suena.
      return fragmentEnded(round)
        ? "Se acabó el fragmento: el anfitrión puede repetirlo o revelar la canción"
        : "El anfitrión pausó la canción";
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
          {mineVerdict.artistAwarded ? `Artista bien, +${mineVerdict.points}. ` : ""}
          No era el título: quedas fuera de esta pista.
        </p>
      )}
      <button type="button" className={styles.bigButton} onClick={buzzIn} disabled={!canBuzz} aria-describedby="buzz-note">
        <Hand size={56} aria-hidden />
        ¡Lo sé!
      </button>
      <p id="buzz-note" className={styles.padNote} role="status">
        {error ?? stateNote ?? "Pulsa cuando creas que la sabes"}
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
      setError(e instanceof ApiError ? e.message : "No se pudo enviar. Revisa tu conexión.");
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
      aria-label="Tu respuesta"
    >
      <div className={styles.answerClock} data-urgent={seconds <= 5} role="timer" aria-live="off">
        <span>{seconds}</span>
        <small> s</small>
      </div>
      <p className={`${styles.padNote} ${styles.answerNote}`}>Es tu turno: la canción está en pausa.</p>
      <label className={styles.answerField}>
        <span>Canción</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título de la canción"
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
        <span>Artista</span>
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Quién la canta"
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
        {busy ? "Enviando…" : "Enviar respuesta"}
      </button>
    </form>
  );
}

