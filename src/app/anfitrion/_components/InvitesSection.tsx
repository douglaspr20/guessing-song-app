"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import { RetryNotice } from "@/components/RetryNotice";
import controls from "@/components/styles/controls.module.css";
import form from "@/components/styles/form.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { api, errorText } from "@/lib/client/api";
import type { Invite, NewInvite } from "../_lib/types";
import { useHostData } from "../_hooks/useHostData";
import styles from "../host.module.css";
import { ListItem, RevealedSecret, Section } from "./PanelBits";

/** Invitaciones: crear un código de un solo uso (se enseña una vez) y anular las que no se usaron. */
export function InvitesSection() {
  const { m, locale } = useI18n();
  const h = m.host;
  const toast = useToast();
  const act = useConfirmedAction();
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
      toast({ text: errorText(err), tone: "error" });
    }
  };

  const revoke = (invite: Invite) =>
    act({
      question: { title: h.revokeTitle, body: h.revokeBody(invite.note), confirmLabel: h.revoke, tone: "danger" },
      run: () => api(`/api/host/invites/${invite.id}`, { method: "DELETE" }),
      done: h.revoked,
      after: reload,
    });

  return (
    <Section title={h.invitesTitle}>
      <p className={styles.text}>{h.invitesText}</p>
      <form className={styles.row} onSubmit={create}>
        <input
          className={`${form.input} ${styles.grow}`}
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
        <RevealedSecret label={h.copyNow} value={created.code} note={created.note ? h.forNote(created.note) : undefined} />
      )}
      {error && <RetryNotice on="card" message={h.cantLoadInvites(error)} onRetry={reload} />}
      {data && data.invites.length > 0 && (
        <ul className={styles.list}>
          {data.invites.map((i) => {
            const expired = !i.usedAt && new Date(i.expiresAt) < new Date();
            return (
              <ListItem
                key={i.id}
                title={i.note || h.noNote}
                meta={
                  i.usedAt
                    ? h.usedBy(i.usedBy, formatDate(locale, i.usedAt))
                    : expired
                      ? h.expired
                      : h.unusedUntil(formatDate(locale, i.expiresAt))
                }
                actions={
                  !i.usedAt && (
                    <button type="button" className={`${ui.btn} ${ui.onCard} ${controls.small}`} onClick={() => revoke(i)}>
                      {h.revoke}
                    </button>
                  )
                }
              />
            );
          })}
        </ul>
      )}
    </Section>
  );
}
