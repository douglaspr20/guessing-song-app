"use client";

import Link from "next/link";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import ui from "@/components/ui.module.css";
import { api, type AccessStatus } from "@/lib/client/api";
import { errorMessage } from "../_lib/useHostData";
import { useI18n } from "@/i18n/client";
import styles from "../host.module.css";
import { GuestsSection } from "./GuestsSection";
import { InvitesSection } from "./InvitesSection";
import { MembersSection } from "./MembersSection";
import { SpotifySection } from "./SpotifySection";

/** Panel del anfitrión: Spotify, invitaciones, miembros y modo sin cuenta. */
export function Panel({ status, onSignedOut }: { status: AccessStatus; onSignedOut: () => void }) {
  const { m } = useI18n();
  const h = m.host;
  const confirm = useConfirm();
  const toast = useToast();

  const signOutEverywhere = async () => {
    const ok = await confirm({
      title: h.signOutAllTitle,
      body: h.signOutAllBody,
      confirmLabel: h.signOutAllConfirm,
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api("/api/host/sessions", { method: "DELETE" });
      onSignedOut();
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
  };
  const signOut = async () => {
    await api("/api/account/logout", { method: "POST" }).catch(() => undefined);
    onSignedOut();
  };

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{h.title}</h1>
          <p className={styles.sub}>{h.sub}</p>
        </div>
        <Link href="/" className={`${ui.btn} ${ui.onShell}`}>
          {h.myShelf}
        </Link>
      </div>

      <div className={styles.grid}>
        <SpotifySection status={status} />
        <InvitesSection />
        <MembersSection />
        <GuestsSection />
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.linkBtn} onClick={signOutEverywhere}>
          {h.signOutAll}
        </button>
        <button type="button" className={styles.linkBtn} onClick={signOut}>
          {h.signOut}
        </button>
      </div>
    </>
  );
}
