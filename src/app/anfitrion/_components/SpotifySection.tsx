"use client";

import { useState } from "react";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import ui from "@/components/ui.module.css";
import { api, type AccessStatus } from "@/lib/client/api";
import { errorMessage } from "../_lib/useHostData";
import { useI18n } from "@/i18n/client";
import styles from "../host.module.css";
import { Section } from "./PanelBits";

export function SpotifySection({ status }: { status: AccessStatus }) {
  const { m } = useI18n();
  const h = m.host;
  const confirm = useConfirm();
  const toast = useToast();
  const [linked, setLinked] = useState(!!status.spotify);

  const unlink = async () => {
    const ok = await confirm({
      title: h.unlinkTitle,
      body: h.unlinkBody,
      confirmLabel: h.unlink,
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api("/api/auth/logout", { method: "POST" });
      setLinked(false);
      toast({ text: h.unlinked });
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
  };

  return (
    <Section title={h.spotifyTitle}>
      <p className={styles.text}>
        {linked
          ? h.linkedAs(status.spotify?.displayName ?? null)
          : h.notLinked}
      </p>
      <div className={styles.row}>
        {linked ? (
          <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.small}`} onClick={unlink}>
            {h.unlink}
          </button>
        ) : (
          <a href="/api/auth/login" className={`${ui.btn} ${ui.primary} ${styles.small}`}>
            {h.connect}
          </a>
        )}
      </div>
    </Section>
  );
}
