"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, Pause, Play, RotateCcw } from "lucide-react";
import ui from "@/components/ui.module.css";
import type { Player } from "@/lib/client/api";
import type { Feedback } from "../_lib/feedback";
import type { RoundClockView } from "../_lib/roundClock";
import type { GuessInput } from "../_lib/useGameController";
import { FeedbackLine } from "./FeedbackLine";
import styles from "../game.module.css";

interface Props {
  players: Player[];
  clock: RoundClockView;
  feedback: Feedback | null;
  busy: boolean;
  playerReady: boolean;
  playing: boolean;
  onSubmit: (guess: GuessInput) => Promise<boolean>;
  onReplay: () => void;
  onTogglePause: () => void;
  onReveal: () => void;
}

/**
 * La carátula donde el anfitrión anota quién respondió y qué dijo, con los controles de la cinta.
 * Se monta una vez por ronda, así que empieza vacía en cada pista.
 */
export function AnswerForm({ players, clock, feedback, busy, playerReady, playing, onSubmit, onReplay, onTogglePause, onReveal }: Props) {
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Por defecto, el primero del marcador.
  const whoId = players.some((p) => p.id === who) ? who : (players[0]?.id ?? "");

  usePlayerShortcuts(players, setWho);

  // En cuanto empieza a sonar, el cursor va al título.
  useEffect(() => {
    if (clock.started) titleRef.current?.focus();
  }, [clock.started]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sent = await onSubmit({ playerId: whoId, title, artist });
    if (!sent) return;
    setTitle("");
    setArtist("");
    titleRef.current?.focus();
  };

  const canSubmit = clock.started && (title.trim() || artist.trim());

  return (
    <form className={`${ui.card} ${styles.answer}`} onSubmit={submit}>
      <fieldset className={styles.who}>
        <legend className={styles.fieldLabel}>¿Quién lo dijo?</legend>
        {players.map((p, i) => (
          <label key={p.id} className={styles.whoOption}>
            <input type="radio" name="who" value={p.id} checked={whoId === p.id} onChange={() => setWho(p.id)} />
            <span>
              {p.name}
              {i < 9 && <kbd>{i + 1}</kbd>}
            </span>
          </label>
        ))}
      </fieldset>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            Canción · <b>{clock.started ? clock.pointsNow : 3} pts</b>
          </span>
          <input
            ref={titleRef}
            type="text"
            className={styles.handInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lo que dijo…"
            autoComplete="off"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Artista · {clock.artistOpen ? <b>+1</b> : "ya no suma"}</span>
          <input
            type="text"
            className={styles.handInput}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Quién la canta…"
            autoComplete="off"
          />
        </label>
      </div>

      <FeedbackLine feedback={feedback} />
      {!clock.started && <p className={styles.fieldLabel}>Se puede responder cuando empiece a sonar.</p>}

      <div className={styles.submitRow}>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onReplay} disabled={busy || !playerReady}>
          {clock.started ? <RotateCcw size={22} aria-hidden /> : <Play size={22} aria-hidden />}
          {clock.started ? "Repetir" : "Reproducir"}
        </button>
        <button
          type="button"
          className={`${ui.btn} ${ui.onCard}`}
          onClick={onTogglePause}
          disabled={busy || (!playing && !clock.canResume)}
        >
          {clock.canResume ? <Play size={22} aria-hidden /> : <Pause size={22} aria-hidden />}
          {clock.canResume ? "Seguir" : "Pausar"}
        </button>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onReveal} disabled={busy}>
          <Eye size={22} aria-hidden />
          Revelar
        </button>
        <button type="submit" className={`${ui.btn} ${ui.primary} ${styles.register}`} disabled={busy || !canSubmit}>
          Registrar respuesta
        </button>
      </div>
    </form>
  );
}

/** Atajo para el anfitrión: las teclas 1-9 eligen jugador (fuera de los campos de texto). */
function usePlayerShortcuts(players: Player[], select: (id: string) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "text") return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && players[n - 1]) select(players[n - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [players, select]);
}
