"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import access from "@/components/access.module.css";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import { api, formatDate } from "@/lib/client/api";
import type { Invite, NewInvite } from "../_lib/types";
import { errorMessage, useHostData } from "../_lib/useHostData";
import styles from "../host.module.css";
import { Section } from "./PanelBits";

export function InvitesSection() {
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
      title: "¿Anular esta invitación?",
      body: `${invite.note ? `La de ${invite.note} ` : "El código "}dejará de servir. Puedes crear otra cuando quieras.`,
      confirmLabel: "Anular",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api(`/api/host/invites/${invite.id}`, { method: "DELETE" });
      toast({ text: "Invitación anulada." });
      await reload();
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
  };

  return (
    <Section title="Invitaciones">
      <p className={styles.text}>
        Cada código sirve una sola vez y caduca en 7 días. Para el modo Spotify, añade además a esa persona en el panel
        de Spotify (caben 4 además de ti).
      </p>
      <form className={styles.row} onSubmit={create}>
        <input
          className={`${access.input} ${styles.grow}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Para quién es (opcional)"
          maxLength={60}
          aria-label="Para quién es la invitación"
        />
        <button type="submit" className={`${ui.btn} ${ui.primary}`}>
          <KeyRound size={22} aria-hidden />
          Crear invitación
        </button>
      </form>
      {created && (
        <div className={styles.newCode} role="status">
          <span className={styles.statLabel}>Cópialo ahora: no se volverá a mostrar</span>
          <span className={styles.codeValue}>{created.code}</span>
          {created.note && <span className={styles.itemMeta}>Para {created.note}</span>}
        </div>
      )}
      {error && <RetryNotice on="card" message={`No se pudieron cargar las invitaciones. ${error}`} onRetry={reload} />}
      {data && data.invites.length > 0 && (
        <ul className={styles.list}>
          {data.invites.map((i) => {
            const expired = !i.usedAt && new Date(i.expiresAt) < new Date();
            return (
              <li key={i.id} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{i.note || "Sin nota"}</span>
                  <span className={styles.itemMeta}>
                    {i.usedAt
                      ? `Usada por ${i.usedBy ?? "un miembro borrado"} el ${formatDate(i.usedAt)}`
                      : expired
                        ? "Caducada"
                        : `Sin usar · caduca el ${formatDate(i.expiresAt)}`}
                  </span>
                </span>
                {!i.usedAt && (
                  <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.small}`} onClick={() => revoke(i)}>
                    Anular
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
