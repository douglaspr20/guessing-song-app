"use client";

import { useEffect, useRef } from "react";
import { BuzzerPad } from "@/components/buzzer/BuzzerPad";
import { PlayerName } from "@/components/PlayerName";
import ui from "@/components/ui.module.css";
import type { HostSeat, Player, Round } from "@/lib/client/api";
import { speechLang } from "@/lib/client/speech";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

/**
 * El anfitrión también juega: su «¡Lo sé!» en su propia pantalla, en una franja sobre el casete. En su turno
 * la franja se convierte en su formulario de respuesta (lo juzga el servidor, como en los móviles).
 */
export function HostBuzzer({
  gameId,
  round,
  seat,
  player,
  fetchedAt,
  onChanged,
  musicLanguage,
}: {
  gameId: string;
  round: Round;
  seat: HostSeat;
  /** Su jugador o equipo (para el color). */
  player: Player | undefined;
  fetchedAt: number;
  onChanged: () => Promise<unknown>;
  /** Idioma de la música de la partida (para dictar la respuesta). */
  musicLanguage: string | null;
}) {
  const { m, locale } = useI18n();
  const ref = useRef<HTMLElement>(null);
  // En el móvil «Empezar» queda abajo y la franja arriba: al empezar cada pista se trae a la vista.
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getBoundingClientRect().top >= 0) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  }, [round.id]);

  return (
    <section ref={ref} className={`${ui.card} ${styles.hostPad}`} aria-label={m.game.hostPlaysAs(seat.name)}>
      <div className={ui.cardStripes} />
      <div className={styles.hostPadBody}>
        <p className={styles.hostPadWho}>
          {m.game.hostPlaysLabel} <PlayerName name={seat.name} color={player?.color} />
        </p>
        <BuzzerPad
          compact
          gameId={gameId}
          round={round}
          me={{ id: seat.id, lockedOut: seat.lockedOut }}
          fetchedAt={fetchedAt}
          onChanged={onChanged}
          speechLang={speechLang(musicLanguage, locale)}
        />
      </div>
    </section>
  );
}
