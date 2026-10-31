"use client";

import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { Mic, Send } from "lucide-react";
import { Notice } from "@/components/Notice";
import ui from "@/components/ui.module.css";
import { useDictation } from "@/hooks/useDictation";
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
  speechLang,
}: {
  gameId: string;
  roundId: string;
  leftAtFetch: number;
  fetchedAt: number;
  onVerdict: (v: Omit<Verdict, "roundId">) => void;
  onChanged: () => Promise<unknown> | void;
  /** Las pistas ya desbloqueadas, bajo el reloj: la de letras ayuda justo al escribir. */
  hints?: ReactNode;
  /** Idioma en que se escucha al dictar (el de la música de la partida o el de la pantalla). */
  speechLang: string;
}) {
  const { m } = useI18n();
  const t = m.play;
  const dictation = useDictation(speechLang);
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
    dictation.stop();
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
      // Solo un campo de texto saca el teclado. Un botón (el micrófono) no: si encogiera el reloj al pulsarlo, el
      // botón se movería bajo el dedo y la pulsación se perdería.
      onFocus={(e) => {
        if (e.target instanceof HTMLInputElement) setTyping(true);
      }}
      onBlur={(e) => {
        // Pasar a otro campo o a un botón del formulario no es dejar de escribir (y así «Enviar» no se mueve).
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
        <div className={styles.fieldRow}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={dictation.listening === "title" ? t.listening : t.songPlaceholder}
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="next"
            onFocus={reveal}
            autoFocus
            disabled={busy}
            maxLength={200}
          />
          {dictation.supported && (
            <MicButton field="title" label={t.dictateSong} dictation={dictation} disabled={busy} onText={setTitle} />
          )}
        </div>
      </label>
      <label className={styles.answerField}>
        <span>{t.artist}</span>
        <div className={styles.fieldRow}>
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder={dictation.listening === "artist" ? t.listening : t.artistPlaceholder}
            autoComplete="off"
            enterKeyHint="send"
            onFocus={reveal}
            disabled={busy}
            maxLength={200}
          />
          {dictation.supported && (
            <MicButton field="artist" label={t.dictateArtist} dictation={dictation} disabled={busy} onText={setArtist} />
          )}
        </div>
      </label>
      {dictation.error ? (
        <p className={`${styles.padNote} ${styles.micNote}`} role="status">
          {{ denied: t.micDenied, noSpeech: t.micNoSpeech, failed: t.micFailed }[dictation.error]}
        </p>
      ) : (
        !dictation.supported && <p className={`${styles.padNote} ${styles.micNote} ${styles.answerNote}`}>{t.keyboardMicHint}</p>
      )}
      {error && <Notice>{error}</Notice>}
      <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.big} ${styles.sendBtn}`} disabled={busy}>
        <Send size={24} aria-hidden />
        {busy ? t.sending : t.send}
      </button>
    </form>
  );
}

/** El micrófono de un campo: pulsar escucha (y vuelve a pulsar para), lo oído cae en el campo. */
function MicButton({
  field,
  label,
  dictation,
  disabled,
  onText,
}: {
  field: string;
  label: string;
  dictation: ReturnType<typeof useDictation>;
  disabled: boolean;
  onText: (text: string) => void;
}) {
  const on = dictation.listening === field;
  return (
    <button
      type="button"
      className={styles.micBtn}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={() => (on ? dictation.stop() : dictation.start(field, onText))}
    >
      <Mic size={26} aria-hidden />
    </button>
  );
}

