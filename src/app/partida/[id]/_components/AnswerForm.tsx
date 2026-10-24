"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, Pause, Play, RotateCcw, ThumbsUp } from "lucide-react";
import ui from "@/components/ui.module.css";
import type { Player } from "@/lib/client/api";
import type { Feedback } from "../_lib/feedback";
import type { RoundClockView } from "../_lib/roundClock";
import type { GameController, GuessInput } from "../_lib/useGameController";
import { FeedbackLine } from "./FeedbackLine";
import { Hint } from "./Hint";
import styles from "../game.module.css";

interface Props {
  players: Player[];
  selected: Player | null;
  onSelect: (id: string) => void;
  clock: RoundClockView;
  feedback: Feedback | null;
  busy: boolean;
  can: GameController["can"];
  onSubmit: (guess: GuessInput) => Promise<boolean>;
  onReplay: () => void;
  onTogglePause: () => void;
  onReveal: () => void;
  onAwardTitle: () => void;
  onAwardArtist: () => void;
}

/**
 * La carátula donde el anfitrión anota quién respondió y qué dijo, con los controles de la cinta.
 * Se monta una vez por ronda, así que empieza vacía en cada pista.
 */
export function AnswerForm({
  players,
  selected,
  onSelect,
  clock,
  feedback,
  busy,
  can,
  onSubmit,
  onReplay,
  onTogglePause,
  onReveal,
  onAwardTitle,
  onAwardArtist,
}: Props) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // En cuanto empieza a sonar, el cursor va al título (Esc lo suelta para usar los atajos).
  useEffect(() => {
    if (clock.started) titleRef.current?.focus();
  }, [clock.started]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const sent = await onSubmit({ playerId: selected.id, title, artist });
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
            <input type="radio" name="who" value={p.id} checked={selected?.id === p.id} onChange={() => onSelect(p.id)} />
            <span>
              {p.name}
              {i < 9 && <kbd className={styles.key}>{i + 1}</kbd>}
            </span>
          </label>
        ))}
      </fieldset>

      {/* Con el mando no se escribe: el anfitrión da lo que el elegido dijo en voz alta. */}
      <div className={styles.spokenRow}>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onAwardTitle} disabled={!can.awardTitle}>
          <ThumbsUp size={22} aria-hidden />
          ¡Acertó la canción!
          <Hint k="C" color="green" />
        </button>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onAwardArtist} disabled={!can.awardArtist}>
          ¡Acertó el artista!
          <Hint k="A" color="yellow" />
        </button>
        {selected && <span className={styles.spokenWho}>a {selected.name}</span>}
      </div>

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
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onReplay} disabled={!can.play}>
          {clock.started ? <RotateCcw size={22} aria-hidden /> : <Play size={22} aria-hidden />}
          {clock.started ? "Repetir" : "Reproducir"}
          <Hint k={clock.started ? "R" : "Espacio"} />
        </button>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onTogglePause} disabled={!can.pause}>
          {clock.canResume ? <Play size={22} aria-hidden /> : <Pause size={22} aria-hidden />}
          {clock.canResume ? "Seguir" : "Pausar"}
          <Hint k="Espacio" />
        </button>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onReveal} disabled={!can.reveal}>
          <Eye size={22} aria-hidden />
          Revelar
          <Hint k="V" color="red" />
        </button>
        <button type="submit" className={`${ui.btn} ${ui.primary} ${styles.register}`} disabled={busy || !canSubmit}>
          Registrar respuesta
        </button>
      </div>
    </form>
  );
}
