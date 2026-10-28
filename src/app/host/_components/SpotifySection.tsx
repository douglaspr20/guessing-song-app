"use client";

import { useState } from "react";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import controls from "@/components/styles/controls.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { api, type AccessStatus } from "@/lib/client/api";
import styles from "../host.module.css";
import { Section } from "./PanelBits";

/** El Spotify del anfitrión: vinculado o no, con su botón. */
export function SpotifySection({ status }: { status: AccessStatus }) {
  const { m } = useI18n();
  const h = m.host;
  const act = useConfirmedAction();
  const [linked, setLinked] = useState(!!status.spotify);

  const unlink = () =>
    act({
      question: { title: h.unlinkTitle, body: h.unlinkBody, confirmLabel: h.unlink, tone: "danger" },
      run: async () => {
        await api("/api/auth/logout", { method: "POST" });
        setLinked(false);
      },
      done: h.unlinked,
    });

  return (
    <Section title={h.spotifyTitle}>
      <p className={styles.text}>{linked ? h.linkedAs(status.spotify?.displayName ?? null) : h.notLinked}</p>
      <div className={styles.row}>
        {linked ? (
          <button type="button" className={`${ui.btn} ${ui.onCard} ${controls.small}`} onClick={unlink}>
            {h.unlink}
          </button>
        ) : (
          <a href="/api/auth/login" className={`${ui.btn} ${ui.primary} ${controls.small}`}>
            {h.connect}
          </a>
        )}
      </div>
    </Section>
  );
}
