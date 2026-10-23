"use client";

import { useState } from "react";
import { useConfirm, useToast, type ConfirmOptions } from "@/components/feedback/FeedbackProvider";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import { api, formatDate } from "@/lib/client/api";
import type { Member } from "../_lib/types";
import { errorMessage, useHostData } from "../_lib/useHostData";
import styles from "../host.module.css";
import { Section } from "./PanelBits";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function MembersSection() {
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload } = useHostData<{ members: Member[] }>("/api/host/members");
  /** Contraseña temporal recién creada: se enseña una sola vez, bajo su miembro. */
  const [reset, setReset] = useState<{ id: string; username: string; password: string } | null>(null);

  const resetPassword = async (m: Member) => {
    const ok = await confirm({
      title: `¿Restablecer la contraseña de @${m.username}?`,
      body: "Se crea una contraseña temporal y se cierran todas sus sesiones. Al entrar con ella se le pedirá ponerse una suya.",
      confirmLabel: "Restablecer",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await api<{ password: string; username: string }>(`/api/host/members/${m.id}/password`, { method: "POST" });
      setReset({ id: m.id, ...res });
      toast({ text: `Contraseña de @${res.username} restablecida.` });
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
    <Section title="Miembros">
      {error && <RetryNotice on="card" message={`No se pudieron cargar los miembros. ${error}`} onRetry={reload} />}
      {data?.members.length === 0 && <p className={styles.text}>Aún no hay miembros. Crea una invitación para el primero.</p>}
      {data && data.members.length > 0 && (
        <ul className={styles.list}>
          {data.members.map((m) => (
            <li key={m.id} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemTitle}>
                  {m.displayName} <span className={styles.itemMeta}>@{m.username}</span>
                </span>
                <span className={styles.itemMeta}>
                  {m.disabled ? "Desactivado · " : ""}
                  {loginMethod(m)} · {m.spotifyAllowed ? "con invitación" : "cuenta gratis"} ·{" "}
                  {m.spotify !== null ? `Spotify${m.spotify ? ` (${m.spotify})` : ""}` : "Sin Spotify"} ·{" "}
                  {plural(m.games, "partida", "partidas")}
                  {m.lastSeenAt ? ` · visto el ${formatDate(m.lastSeenAt)}` : ""}
                </span>
              </span>
              <span className={styles.row}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                  onClick={() =>
                    act(
                      member(m, { method: "PATCH", json: { disabled: !m.disabled } }),
                      m.disabled ? `@${m.username} puede volver a entrar.` : `@${m.username} ya no puede entrar.`,
                      m.disabled
                        ? undefined
                        : {
                            title: `¿Desactivar a @${m.username}?`,
                            body: "No podrá entrar hasta que lo reactives. Sus partidas se conservan.",
                            confirmLabel: "Desactivar",
                            tone: "danger",
                          },
                    )
                  }
                >
                  {m.disabled ? "Reactivar" : "Desactivar"}
                </button>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                  onClick={() =>
                    act(
                      member(m, { method: "PATCH", json: { spotifyAllowed: !m.spotifyAllowed } }),
                      m.spotifyAllowed
                        ? `@${m.username} ya no puede usar el modo Spotify.`
                        : `@${m.username} ya puede usar el modo Spotify.`,
                      m.spotifyAllowed
                        ? {
                            title: `¿Quitarle el modo Spotify a @${m.username}?`,
                            body: "También se desvincula su cuenta de Spotify. Sus partidas se conservan y puede seguir jugando sin cuenta.",
                            confirmLabel: "Quitar Spotify",
                            tone: "danger",
                          }
                        : {
                            title: `¿Darle el modo Spotify a @${m.username}?`,
                            body: "Podrá vincular su propia cuenta Premium. Recuerda añadirla también en el panel de Spotify.",
                            confirmLabel: "Permitir Spotify",
                          },
                    )
                  }
                >
                  {m.spotifyAllowed ? "Quitar Spotify" : "Permitir Spotify"}
                </button>
                <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.small}`} onClick={() => resetPassword(m)}>
                  {m.hasPassword ? "Restablecer contraseña" : "Crear contraseña"}
                </button>
                {m.sessions > 0 && (
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                    onClick={() =>
                      act(member(m, { method: "PATCH", json: { revokeSessions: true } }), `Sesiones de @${m.username} cerradas.`)
                    }
                  >
                    Cerrar sesiones
                  </button>
                )}
                {m.games > 0 && (
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                    onClick={() =>
                      act(
                        () => api(`/api/host/members/${m.id}/games`, { method: "DELETE" }),
                        `Historial de @${m.username} borrado.`,
                        {
                          title: `¿Borrar el historial de @${m.username}?`,
                          body: (
                            <>
                              Se borrarán sus <strong>{plural(m.games, "partida", "partidas")}</strong>. Su cuenta y su
                              Spotify se mantienen. No se puede deshacer.
                            </>
                          ),
                          confirmLabel: "Borrar historial",
                          tone: "danger",
                          typeToConfirm: "BORRAR",
                        },
                      )
                    }
                  >
                    Borrar historial
                  </button>
                )}
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small} ${styles.danger}`}
                  onClick={() =>
                    act(member(m, { method: "DELETE" }), `@${m.username} borrado.`, {
                      title: `¿Borrar a @${m.username}?`,
                      body: "Se borra su cuenta con todas sus partidas y su Spotify vinculado. No se puede deshacer.",
                      confirmLabel: "Borrar miembro",
                      tone: "danger",
                      typeToConfirm: "BORRAR",
                    })
                  }
                >
                  Borrar
                </button>
              </span>
              {reset?.id === m.id && (
                <div className={`${styles.newCode} ${styles.fullRow}`} role="status">
                  <span className={styles.statLabel}>Contraseña temporal de @{reset.username}: cópiala ahora</span>
                  <span className={styles.codeValue}>{reset.password}</span>
                  <span className={styles.itemMeta}>
                    Dásela en persona o por un canal privado. Al entrar se le pedirá cambiarla.
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
function loginMethod(m: Member) {
  if (m.google && m.hasPassword) return `Google (${m.google}) y contraseña`;
  if (m.google) return `Google (${m.google})`;
  return "Contraseña";
}
