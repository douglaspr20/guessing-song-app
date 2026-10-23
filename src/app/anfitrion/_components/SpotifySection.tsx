"use client";

import { useState } from "react";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import ui from "@/components/ui.module.css";
import { api, type AccessStatus } from "@/lib/client/api";
import { errorMessage } from "../_lib/useHostData";
import styles from "../host.module.css";
import { Section } from "./PanelBits";

export function SpotifySection({ status }: { status: AccessStatus }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [linked, setLinked] = useState(!!status.spotify);

  const unlink = async () => {
    const ok = await confirm({
      title: "¿Desvincular tu Spotify?",
      body: "Tendrás que volver a conectarlo para grabar partidas con la canción entera.",
      confirmLabel: "Desvincular",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api("/api/auth/logout", { method: "POST" });
      setLinked(false);
      toast({ text: "Spotify desvinculado." });
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
  };

  return (
    <Section title="Mi Spotify">
      <p className={styles.text}>
        {linked
          ? `Vinculado${status.spotify?.displayName ? ` como ${status.spotify.displayName}` : ""}. Solo tú lo usas: cada miembro conecta el suyo.`
          : "Sin vincular. Conéctalo para grabar partidas con la canción entera."}
      </p>
      <div className={styles.row}>
        {linked ? (
          <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.small}`} onClick={unlink}>
            Desvincular
          </button>
        ) : (
          <a href="/api/auth/login" className={`${ui.btn} ${ui.primary} ${styles.small}`}>
            Conectar Spotify
          </a>
        )}
      </div>
    </Section>
  );
}
