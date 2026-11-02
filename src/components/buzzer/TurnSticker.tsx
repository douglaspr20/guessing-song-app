"use client";

import { useEffect, useRef, useState } from "react";
import { TeamDot } from "@/components/TeamDot";
import { useI18n } from "@/i18n/client";
import type { Round } from "@/lib/client/api";
import styles from "./TurnSticker.module.css";

/** Lo que dura la etiqueta: se pega, se queda a la vista y se va a su sitio (el cartel del turno). */
export const TURN_STICKER_MS = 3_200;
/**
 * Si el turno ya llevaba más que esto al verlo (p. ej. al recargar a mitad), no se anuncia otra vez. Holgado porque
 * sin tiempo real la pantalla se entera por el sondeo de cada 3 s.
 */
const FRESH_TURN_MS = 6_000;

/**
 * La etiqueta del turno que toca enseñar ahora, o null. Sale una vez por turno, solo si el turno acaba de
 * empezar (no al recargar la página a mitad), y se quita sola a los `TURN_STICKER_MS`.
 */
export function useTurnSticker(roundId: string | undefined, buzz: Round["buzz"] | undefined) {
  const [showing, setShowing] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const key = roundId && buzz ? `${roundId}:${buzz.participantId}` : null;
  const fresh = !!buzz && buzz.totalMs - buzz.remainingMs < FRESH_TURN_MS;

  useEffect(() => {
    if (!key || seen.current.has(key)) return;
    seen.current.add(key);
    if (!fresh) return;
    // Un turno nuevo: la etiqueta se pega ahora y se va sola (lo que la dispara es el aviso del servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowing(key);
    const id = setTimeout(() => setShowing((k) => (k === key ? null : k)), TURN_STICKER_MS);
    return () => clearTimeout(id);
  }, [key, fresh]);

  return showing && showing === key ? buzz! : null;
}

/**
 * «¡Pablo! TIENE EL TURNO»: una etiqueta de cartulina que se pega sobre el casete (o sobre el botón del móvil)
 * cuando alguien pulsa «¡Lo sé!», para que la sala lo vea aunque la canción siga sonando. Después se encoge
 * hacia el cartel del turno. Es decorativa para los lectores de pantalla: el cartel ya lo anuncia.
 */
export function TurnSticker({ name, color, size = "tv" }: { name: string; color?: string | null; size?: "tv" | "phone" }) {
  const { m } = useI18n();
  return (
    <div className={`${styles.sticker} ${size === "phone" ? styles.phone : ""}`} aria-hidden>
      <div className={styles.stripes} />
      <p className={styles.tag}>{m.game.turnSticker}</p>
      <p className={styles.name}>
        <TeamDot color={color} size={size === "phone" ? 18 : 28} />
        <span className={styles.nameText}>{m.game.turnName(name)}</span>
      </p>
    </div>
  );
}
