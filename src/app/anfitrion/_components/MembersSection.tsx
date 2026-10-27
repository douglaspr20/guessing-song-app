"use client";

import { useState } from "react";
import { useConfirm, useToast, type ConfirmOptions } from "@/components/feedback/FeedbackProvider";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { formatDate, plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import type { Member } from "../_lib/types";
import { errorMessage, useHostData } from "../_lib/useHostData";
import styles from "../host.module.css";
import { Section } from "./PanelBits";

export function MembersSection() {
  const { m: text, locale } = useI18n();
  const h = text.host;
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload } = useHostData<{ members: Member[] }>("/api/host/members");
  /** Contraseña temporal recién creada: se enseña una sola vez, bajo su miembro. */
  const [reset, setReset] = useState<{ id: string; username: string; password: string } | null>(null);

  const resetPassword = async (m: Member) => {
    const ok = await confirm({
      title: h.resetTitle(m.username),
      body: h.resetBody,
      confirmLabel: h.resetConfirm,
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await api<{ password: string; username: string }>(`/api/host/members/${m.id}/password`, { method: "POST" });
      setReset({ id: m.id, ...res });
      toast({ text: h.resetDone(res.username) });
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
    await reload();
  };

  /** Acción sobre un miembro: confirma si hace falta, llama a la API y avisa del resultado. */
  const act = async (
    run: () => Promise<unknown>,
    done: string,
    question?: ConfirmOptions,
  ) => {
    if (question && !(await confirm(question))) return;
    try {
      await run();
      toast({ text: done });
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
    await reload();
  };

  const member = (m: Member, init: { method: string; json?: unknown }) => () => api(`/api/host/members/${m.id}`, init);

  return (
    <Section title={h.membersTitle}>
      {error && <RetryNotice on="card" message={h.cantLoadMembers(error)} onRetry={reload} />}
      {data?.members.length === 0 && <p className={styles.text}>{h.noMembers}</p>}
      {data && data.members.length > 0 && (
        <ul className={styles.list}>
          {data.members.map((m) => (
            <li key={m.id} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemTitle}>
                  {m.displayName} <span className={styles.itemMeta}>@{m.username}</span>
                </span>
                <span className={styles.itemMeta}>
                  {m.disabled ? h.disabledPrefix : ""}
                  {loginMethod(m, h)} · {m.spotifyAllowed ? h.withInvite : h.freeAccount} ·{" "}
                  {m.spotify !== null ? h.spotifyOf(m.spotify) : h.noSpotify} · {plural(locale, m.games, h.games)}
                  {m.lastSeenAt ? h.seenOn(formatDate(locale, m.lastSeenAt)) : ""}
                </span>
              </span>
              <span className={styles.row}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                  onClick={() =>
                    act(
                      member(m, { method: "PATCH", json: { disabled: !m.disabled } }),
                      m.disabled ? h.canEnterAgain(m.username) : h.cantEnter(m.username),
                      m.disabled
                        ? undefined
                        : {
                            title: h.disableTitle(m.username),
                            body: h.disableBody,
                            confirmLabel: h.disable,
                            tone: "danger",
                          },
                    )
                  }
                >
                  {m.disabled ? h.enable : h.disable}
                </button>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                  onClick={() =>
                    act(
                      member(m, { method: "PATCH", json: { spotifyAllowed: !m.spotifyAllowed } }),
                      m.spotifyAllowed
                        ? h.spotifyRemoved(m.username)
                        : h.spotifyGranted(m.username),
                      m.spotifyAllowed
                        ? {
                            title: h.removeSpotifyTitle(m.username),
                            body: h.removeSpotifyBody,
                            confirmLabel: h.removeSpotify,
                            tone: "danger",
                          }
                        : {
                            title: h.grantSpotifyTitle(m.username),
                            body: h.grantSpotifyBody,
                            confirmLabel: h.grantSpotify,
                          },
                    )
                  }
                >
                  {m.spotifyAllowed ? h.removeSpotify : h.grantSpotify}
                </button>
                <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.small}`} onClick={() => resetPassword(m)}>
                  {m.hasPassword ? h.resetPassword : h.createPassword}
                </button>
                {m.sessions > 0 && (
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                    onClick={() =>
                      act(member(m, { method: "PATCH", json: { revokeSessions: true } }), h.sessionsClosed(m.username))
                    }
                  >
                    {h.closeSessions}
                  </button>
                )}
                {m.games > 0 && (
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                    onClick={() =>
                      act(
                        () => api(`/api/host/members/${m.id}/games`, { method: "DELETE" }),
                        h.historyDeleted(m.username),
                        {
                          title: h.deleteHistoryTitle(m.username),
                          body: (
                            <>
                              {h.deleteHistoryBefore} <strong>{plural(locale, m.games, h.games)}</strong>
                              {h.deleteHistoryAfter}
                            </>
                          ),
                          confirmLabel: h.deleteHistory,
                          tone: "danger",
                          typeToConfirm: text.home.deleteAllWord,
                        },
                      )
                    }
                  >
                    {h.deleteHistory}
                  </button>
                )}
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small} ${styles.danger}`}
                  onClick={() =>
                    act(member(m, { method: "DELETE" }), h.memberDeleted(m.username), {
                      title: h.deleteMemberTitle(m.username),
                      body: h.deleteMemberBody,
                      confirmLabel: h.deleteMember,
                      tone: "danger",
                      typeToConfirm: text.home.deleteAllWord,
                    })
                  }
                >
                  {h.delete}
                </button>
              </span>
              {reset?.id === m.id && (
                <div className={`${styles.newCode} ${styles.fullRow}`} role="status">
                  <span className={styles.statLabel}>{h.tempPassword(reset.username)}</span>
                  <span className={styles.codeValue}>{reset.password}</span>
                  <span className={styles.itemMeta}>
                    {h.tempPasswordHint}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Cómo entra cada miembro: con Google, con contraseña o de las dos formas. */
function loginMethod(m: Member, h: Messages["host"]) {
  if (m.google && m.hasPassword) return h.loginGoogleAndPassword(m.google);
  if (m.google) return h.loginGoogle(m.google);
  return h.loginPassword;
}
