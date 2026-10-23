"use client";

import { useConfirm, useToast, type ConfirmOptions } from "@/components/feedback/FeedbackProvider";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import { api, formatDate } from "@/lib/client/api";
import type { GuestOverview } from "../_lib/types";
import { errorMessage, useHostData } from "../_lib/useHostData";
import styles from "../host.module.css";
import { Section, Stat } from "./PanelBits";

type Flags = Partial<Pick<GuestOverview, "openModePaused" | "guestSignupsPaused">>;

export function GuestsSection() {
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload, setData } = useHostData<GuestOverview>("/api/host/guests");

  const setFlag = async (flags: Flags) => {
    try {
      setData(await api<GuestOverview>("/api/host/guests", { method: "PATCH", json: flags }));
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
  };

  const action = async (body: Record<string, string>, question: ConfirmOptions, report: (n: number) => string) => {
    if (!(await confirm(question))) return;
    try {
      const res = await api<{ affected: number; overview: GuestOverview }>("/api/host/guests", { json: body });
      setData(res.overview);
      toast({ text: report(res.affected) });
    } catch (err) {
      toast({ text: errorMessage(err), tone: "error" });
    }
  };

  if (!data) {
    return (
      <Section title="Modo sin cuenta">
        {error && <RetryNotice on="card" message={`No se pudo cargar el modo sin cuenta. ${error}`} onRetry={reload} />}
      </Section>
    );
  }

  return (
    <Section title="Modo sin cuenta">
      <div className={styles.stats}>
        <Stat value={data.guests} label="Invitados" />
        <Stat value={data.newGuests} label="Nuevos en 24 h" />
        <Stat value={`${data.games}/${data.gameCapacity}`} label="Partidas" />
        <Stat value={data.blocked} label="Bloqueados" />
      </div>

      <label className={styles.toggle}>
        <input type="checkbox" checked={data.openModePaused} onChange={(e) => setFlag({ openModePaused: e.target.checked })} />
        Pausar el modo sin cuenta (los visitantes ven un aviso de mantenimiento)
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={data.guestSignupsPaused}
          onChange={(e) => setFlag({ guestSignupsPaused: e.target.checked })}
        />
        No admitir invitados nuevos (los que ya juegan siguen)
      </label>

      <div className={styles.row}>
        <button
          type="button"
          className={`${ui.btn} ${ui.onCard} ${styles.small}`}
          onClick={() =>
            action(
              { action: "delete-inactive" },
              {
                title: "¿Borrar los invitados inactivos?",
                body: `Se borran los que no juegan desde hace ${data.inactiveDays} días, con sus partidas.`,
                confirmLabel: "Borrar inactivos",
                tone: "danger",
              },
              (n) => (n === 1 ? "1 invitado inactivo borrado." : `${n} invitados inactivos borrados.`),
            )
          }
        >
          Borrar inactivos
        </button>
        <button
          type="button"
          className={`${ui.btn} ${ui.onCard} ${styles.small} ${styles.danger}`}
          onClick={() =>
            action(
              { action: "delete-all", confirm: "BORRAR" },
              {
                title: "¿Borrar a todos los invitados?",
                body: "Se borran todos los visitantes sin cuenta y sus partidas. No se puede deshacer.",
                confirmLabel: "Borrar todos",
                tone: "danger",
                typeToConfirm: "BORRAR",
              },
              (n) => (n === 1 ? "1 invitado borrado." : `${n} invitados borrados.`),
            )
          }
        >
          Borrar todos
        </button>
      </div>

      {data.topIps.length > 0 && (
        <>
          <p className={styles.text}>Conexiones con más invitados nuevos en 24 h (la IP se guarda como hash):</p>
          <ul className={styles.list}>
            {data.topIps.map((ip) => {
              const isBlocked = data.blockedIps.some((b) => b.ipHash === ip.ipHash);
              return (
                <li key={ip.ipHash} className={styles.item}>
                  <span className={styles.itemMain}>
                    <span className={styles.itemTitle}>{ip.label}…</span>
                    <span className={styles.itemMeta}>
                      {ip.guests} {ip.guests === 1 ? "invitado" : "invitados"}
                      {isBlocked ? " · bloqueada" : ""}
                    </span>
                  </span>
                  {!isBlocked && (
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.onCard} ${styles.small} ${styles.danger}`}
                      onClick={() =>
                        action(
                          { action: "block-ip", ipHash: ip.ipHash },
                          {
                            title: "¿Bloquear esta conexión?",
                            body: "Sus invitados dejarán de poder jugar y no podrá crear otros. Puedes desbloquearla después.",
                            confirmLabel: "Bloquear",
                            tone: "danger",
                          },
                          (n) => `Conexión bloqueada (${n === 1 ? "1 invitado" : `${n} invitados`}).`,
                        )
                      }
                    >
                      Bloquear
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {data.blockedIps.length > 0 && (
        <>
          <p className={styles.text}>Conexiones bloqueadas:</p>
          <ul className={styles.list}>
            {data.blockedIps.map((b) => (
              <li key={b.ipHash} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{b.label}…</span>
                  <span className={styles.itemMeta}>Desde el {formatDate(b.createdAt)}</span>
                </span>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                  onClick={() =>
                    action(
                      { action: "unblock-ip", ipHash: b.ipHash },
                      { title: "¿Desbloquear esta conexión?", body: "Podrá volver a jugar sin cuenta.", confirmLabel: "Desbloquear" },
                      () => "Conexión desbloqueada.",
                    )
                  }
                >
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
