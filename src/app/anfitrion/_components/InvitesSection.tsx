"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import access from "@/components/access.module.css";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { formatDate } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import type { Invite, NewInvite } from "../_lib/types";
import { errorMessage, useHostData } from "../_lib/useHostData";
import styles from "../host.module.css";
import { Section } from "./PanelBits";

export function InvitesSection() {
  const { m, locale } = useI18n();
  const h = m.host;
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload } = useHostData<{ invites: Invite[] }>("/api/host/invites");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<NewInvite | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setCreated(await api<NewInvite>("/api/host/invites", { json: { note } }));
      setNote("");
      await reload();
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
  };

  const revoke = async (invite: Invite) => {
    const ok = await confirm({
      title: h.revokeTitle,
      body: h.revokeBody(invite.note),
      confirmLabel: h.revoke,
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api(`/api/host/invites/${invite.id}`, { method: "DELETE" });
      toast({ text: h.revoked });
      await reload();
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
  };

  return (
    <Section title={h.invitesTitle}>
      <p className={styles.text}>
        {h.invitesText}
      </p>
      <form className={styles.row} onSubmit={create}>
        <input
          className={`${access.input} ${styles.grow}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={h.forWhomPlaceholder}
          maxLength={60}
          aria-label={h.forWhomLabel}
        />
        <button type="submit" className={`${ui.btn} ${ui.primary}`}>
          <KeyRound size={22} aria-hidden />
          {h.createInvite}
        </button>
      </form>
      {created && (
        <div className={styles.newCode} role="status">
          <span className={styles.statLabel}>{h.copyNow}</span>
          <span className={styles.codeValue}>{created.code}</span>
          {created.note && <span className={styles.itemMeta}>{h.forNote(created.note)}</span>}
        </div>
      )}
      {error && <RetryNotice on="card" message={h.cantLoadInvites(error)} onRetry={reload} />}
      {data && data.invites.length > 0 && (
        <ul className={styles.list}>
          {data.invites.map((i) => {
            const expired = !i.usedAt && new Date(i.expiresAt) < new Date();
            return (
              <li key={i.id} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{i.note || h.noNote}</span>
                  <span className={styles.itemMeta}>
                    {i.usedAt
                      ? h.usedBy(i.usedBy, formatDate(locale, i.usedAt))
                      : expired
                        ? h.expired
                        : h.unusedUntil(formatDate(locale, i.expiresAt))}
                  </span>
                </span>
                {!i.usedAt && (
                  <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.small}`} onClick={() => revoke(i)}>
                    {h.revoke}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
