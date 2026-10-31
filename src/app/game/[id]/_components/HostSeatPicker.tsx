"use client";

import { useId, useState } from "react";
import { Chip, chipsClass } from "@/components/Chip";
import controls from "@/components/styles/controls.module.css";
import { useToast } from "@/components/feedback/FeedbackProvider";
import ui from "@/components/ui.module.css";
import { api, errorText, type HostGame } from "@/lib/client/api";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

/**
 * En la sala, antes de la primera pista: «¿Juegas tú también?». Tocar un nombre hace que este navegador juegue
 * con él (su «¡Lo sé!» saldrá en esta misma pantalla); tocar otro lo cambia y «No juego» lo deja libre.
 */
export function HostSeatPicker({ game, onChanged }: { game: HostGame; onChanged: () => Promise<unknown> }) {
  const { m } = useI18n();
  const g = m.game;
  const toast = useToast();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const names = game.format === "teams" ? game.players.flatMap((p) => p.members) : game.players.map((p) => p.name);
  const mine = game.hostSeat?.name ?? null;

  const send = async (init: Parameters<typeof api>[1]) => {
    setBusy(true);
    try {
      await api(`/api/games/${game.id}/host-seat`, init);
      await onChanged();
    } catch (e) {
      toast({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${ui.card} ${styles.hostPick}`} aria-labelledby={titleId}>
      <div className={styles.hostPadBody}>
        <h2 className={styles.hostPickTitle} id={titleId}>
          {mine ? g.hostJoined(mine) : g.hostJoinQuestion}
        </h2>
        {!mine && <p className={styles.hostPickHelp}>{g.hostJoinHelp}</p>}
        <div className={chipsClass} role="group" aria-label={g.hostJoinPick}>
          {names.map((name) => (
            <Chip
              key={name}
              hand
              pressed={name === mine}
              disabled={busy}
              onClick={() => name !== mine && send({ method: "PUT", json: { name } })}
            >
              {name}
            </Chip>
          ))}
        </div>
        {mine && (
          <button
            type="button"
            className={`${ui.btn} ${ui.onCard} ${controls.small} ${styles.hostPickLeave}`}
            disabled={busy}
            onClick={() => send({ method: "DELETE" })}
          >
            {g.hostLeave}
          </button>
        )}
      </div>
    </section>
  );
}
