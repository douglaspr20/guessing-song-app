"use client";

import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { Send } from "lucide-react";
import { Notice } from "@/components/Notice";
import ui from "@/components/ui.module.css";
import { useRemainingMs } from "@/hooks/useNow";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/client/api";
import styles from "./Buzzer.module.css";

/** Lo que dijo el servidor de la respuesta enviada. */
export interface Verdict {
  roundId: string;
  titleAwarded: boolean;
  artistAwarded: boolean;
  points: number;
}

/**
 * Tu turno tras pulsar «¡Lo sé!»: la cuenta atrás grande y los campos de canción y artista.
 * Al acabarse el tiempo se envía lo que hubiera escrito (aunque sea nada).
 */
export function BuzzAnswerForm({
  gameId,
  roundId,
  leftAtFetch,
  fetchedAt,
  onVerdict,
  onChanged,
  hints,
}: {
  gameId: string;
  roundId: string;
  leftAtFetch: number;
  fetchedAt: number;
  onVerdict: (v: Omit<Verdict, "roundId">) => void;
  onChanged: () => Promise<unknown> | void;
  /** Las pistas ya desbloqueadas, bajo el reloj: la de letras ayuda justo al escribir. */
  hints?: ReactNode;
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
  const left = useRemainingMs(leftAtFetch, fetchedAt);
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
      {hints && <div className={styles.answerHints}>{hints}</div>}
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
      {error && <Notice>{error}</Notice>}
      <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.big} ${styles.sendBtn}`} disabled={busy}>
        <Send size={24} aria-hidden />
        {busy ? t.sending : t.send}
      </button>
    </form>
  );
}

