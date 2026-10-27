"use client";

import { useState } from "react";
import { RetryNotice } from "@/components/RetryNotice";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/client/api";
import type { Member } from "../_lib/types";
import { useHostData } from "../_hooks/useHostData";
import styles from "../host.module.css";
import { MemberRow } from "./MemberRow";
import { Section } from "./PanelBits";

/** Miembros con cuenta: quién es cada uno, cómo entra y las acciones del anfitrión sobre su cuenta. */
export function MembersSection() {
  const { m } = useI18n();
  const h = m.host;
  const act = useConfirmedAction();
  const { data, error, reload } = useHostData<{ members: Member[] }>("/api/host/members");
  /** Contraseña temporal recién creada: se enseña una sola vez, bajo su miembro. */
  const [reset, setReset] = useState<{ id: string; username: string; password: string } | null>(null);

  const resetPassword = (member: Member) =>
    act({
      question: { title: h.resetTitle(member.username), body: h.resetBody, confirmLabel: h.resetConfirm, tone: "danger" },
      run: async () => {
        const res = await api<{ password: string; username: string }>(`/api/host/members/${member.id}/password`, {
          method: "POST",
        });
        setReset({ id: member.id, ...res });
        return res;
      },
      done: (res) => h.resetDone(res.username),
      after: reload,
    });

  return (
    <Section title={h.membersTitle}>
      {error && <RetryNotice on="card" message={h.cantLoadMembers(error)} onRetry={reload} />}
      {data?.members.length === 0 && <p className={styles.text}>{h.noMembers}</p>}
      {data && data.members.length > 0 && (
        <ul className={styles.list}>
          {data.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              reset={reset?.id === member.id ? reset : null}
              onResetPassword={() => resetPassword(member)}
              onChanged={reload}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}
