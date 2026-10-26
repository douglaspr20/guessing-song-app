"use client";

import { Ban, Hand, ThumbsUp, X } from "lucide-react";
import { TeamDot } from "@/components/TeamDot";
import ui from "@/components/ui.module.css";
import type { Round } from "@/lib/client/api";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

type Buzz = NonNullable<Round["buzz"]>;

/**
 * Alguien pulsó «¡Lo sé!» en su móvil: la canción está en pausa y tiene unos segundos para responder.
 * Grande y legible desde el sofá; el anfitrión puede dar la canción por buena si lo dijo en voz alta,
 * darlo por fallado o cancelar el turno (si pulsó sin querer).
 */
export function BuzzBanner({
  buzz,
  leftMs,
  color,
  teamName,
  busy,
  onAward,
  onFail,
  onCancel,
}: {
  buzz: Buzz;
  leftMs: number;
  color: string | null;
  /** Nombre del equipo si juega por equipos. */
  teamName: string | null;
  busy: boolean;
  onAward: () => void;
  onFail: () => void;
  onCancel: () => void;
}) {
  const { m } = useI18n();
  const g = m.game;
  const seconds = Math.ceil(leftMs / 1000);
  const fraction = buzz.totalMs ? Math.min(1, Math.max(0, leftMs / buzz.totalMs)) : 0;
  const urgent = seconds <= 5;

  return (
    <section className={`${ui.card} ${styles.buzz}`} aria-live="assertive" aria-label={g.buzzTurn}>
      <div className={ui.cardStripes} />
      <div className={styles.buzzBody}>
        <div className={styles.buzzWho}>
          <Hand size={34} aria-hidden />
          <div>
            <p className={styles.buzzName}>
              <TeamDot color={color} size={20} />
              {buzz.name || g.buzzSomeone}
            </p>
            <p className={styles.buzzSub}>
              {teamName ? `${teamName} · ` : ""}
              {g.buzzSub}
            </p>
          </div>
        </div>
        <div className={styles.buzzClock} data-urgent={urgent}>
          <span className={styles.buzzSeconds}>
            {seconds}
            <small> s</small>
          </span>
          <span className="sr-only">{g.secondsLeft(seconds)}</span>
        </div>
      </div>
      <div className={styles.buzzBar} aria-hidden>
        <span style={{ transform: `scaleX(${fraction})` }} data-urgent={urgent} />
      </div>
      <div className={styles.buzzActions}>
        <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={onAward} disabled={busy}>
          <ThumbsUp size={22} aria-hidden />
          {g.saidRight}
        </button>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onFail} disabled={busy}>
          <X size={22} aria-hidden />
          {g.failed}
        </button>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onCancel} disabled={busy}>
          <Ban size={22} aria-hidden />
          {g.cancelTurn}
        </button>
      </div>
    </section>
  );
}
