"use client";

import Link from "next/link";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import ui from "@/components/ui.module.css";
import { api, type AccessStatus } from "@/lib/client/api";
import { useI18n } from "@/i18n/client";
import styles from "../host.module.css";
import { GuestsSection } from "./GuestsSection";
import { InvitesSection } from "./InvitesSection";
import { MembersSection } from "./MembersSection";
import { SpotifySection } from "./SpotifySection";
import { StatsSection } from "./StatsSection";

/** Panel del anfitrión: Spotify, invitaciones, miembros y modo sin cuenta. */
export function Panel({ status, onSignedOut }: { status: AccessStatus; onSignedOut: () => void }) {
  const { m } = useI18n();
  const h = m.host;
  const act = useConfirmedAction();

  const signOutEverywhere = () =>
    act({
      question: { title: h.signOutAllTitle, body: h.signOutAllBody, confirmLabel: h.signOutAllConfirm, tone: "danger" },
      run: async () => {
        await api("/api/host/sessions", { method: "DELETE" });
        onSignedOut();
      },
    });
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
        <StatsSection />
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
