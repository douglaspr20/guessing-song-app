"use client";

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
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
