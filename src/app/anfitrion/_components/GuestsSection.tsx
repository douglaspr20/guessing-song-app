"use client";

import type { ConfirmOptions } from "@/components/feedback/FeedbackProvider";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import { RetryNotice } from "@/components/RetryNotice";
import controls from "@/components/styles/controls.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { formatDate, plural } from "@/i18n/format";
import { api, errorText } from "@/lib/client/api";
import type { GuestOverview } from "../_lib/types";
import { useHostData } from "../_hooks/useHostData";
import styles from "../host.module.css";
import { ListItem, Section, Stat } from "./PanelBits";

type Flags = Partial<Pick<GuestOverview, "openModePaused" | "guestSignupsPaused">>;
type GuestAction = (body: Record<string, string>, question: ConfirmOptions, report: (n: number) => string) => void;

const SMALL = `${ui.btn} ${ui.onCard} ${controls.small}`;

/** Modo sin cuenta: cifras, interruptores, limpieza y las conexiones con más invitados o bloqueadas. */
export function GuestsSection() {
  const { m, locale } = useI18n();
  const h = m.host;
  const toast = useToast();
  const act = useConfirmedAction();
  const { data, error, reload, setData } = useHostData<GuestOverview>("/api/host/guests");

  const setFlag = async (flags: Flags) => {
    try {
      setData(await api<GuestOverview>("/api/host/guests", { method: "PATCH", json: flags }));
    } catch (err) {
      toast({ text: errorText(err), tone: "error" });
    }
  };

  const action: GuestAction = (body, question, report) =>
    act({
      question,
      run: async () => {
        const res = await api<{ affected: number; overview: GuestOverview }>("/api/host/guests", { json: body });
        setData(res.overview);
        return res;
      },
      done: (res) => report(res.affected),
    });

  if (!data) {
    return (
      <Section title={h.guestsTitle}>
        {error && <RetryNotice on="card" message={h.cantLoadGuests(error)} onRetry={reload} />}
      </Section>
    );
  }

  return (
    <Section title={h.guestsTitle}>
      <div className={styles.stats}>
        <Stat value={data.guests} label={h.statGuests} />
        <Stat value={data.newGuests} label={h.statNew} />
        <Stat value={`${data.games}/${data.gameCapacity}`} label={h.statGames} />
        <Stat value={data.blocked} label={h.statBlocked} />
      </div>

      <label className={styles.toggle}>
        <input type="checkbox" checked={data.openModePaused} onChange={(e) => setFlag({ openModePaused: e.target.checked })} />
        {h.pauseOpenMode}
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={data.guestSignupsPaused}
          onChange={(e) => setFlag({ guestSignupsPaused: e.target.checked })}
        />
        {h.pauseSignups}
      </label>

      <div className={styles.row}>
        <button
          type="button"
          className={SMALL}
          onClick={() =>
            action(
              { action: "delete-inactive" },
              {
                title: h.deleteInactiveTitle,
                body: h.deleteInactiveBody(data.inactiveDays),
                confirmLabel: h.deleteInactive,
                tone: "danger",
              },
              (n) => plural(locale, n, h.inactiveDeleted),
            )
          }
        >
          {h.deleteInactive}
        </button>
        <button
          type="button"
          className={`${SMALL} ${styles.danger}`}
          onClick={() =>
            action(
              { action: "delete-all", confirm: "BORRAR" },
              {
                title: h.deleteAllTitle,
                body: h.deleteAllBody,
                confirmLabel: h.deleteAll,
                tone: "danger",
                typeToConfirm: m.home.deleteAllWord,
              },
              (n) => plural(locale, n, h.allDeleted),
            )
          }
        >
          {h.deleteAll}
        </button>
      </div>

      <TopIps data={data} onAction={action} />
      <BlockedIps data={data} onAction={action} />
    </Section>
  );
}

/** Conexiones con más invitados nuevos en 24 h, con el botón de bloquear. */
function TopIps({ data, onAction }: { data: GuestOverview; onAction: GuestAction }) {
  const { m, locale } = useI18n();
  const h = m.host;
  if (!data.topIps.length) return null;
  return (
    <>
      <p className={styles.text}>{h.topIps}</p>
      <ul className={styles.list}>
        {data.topIps.map((ip) => {
          const isBlocked = data.blockedIps.some((b) => b.ipHash === ip.ipHash);
          return (
            <ListItem
              key={ip.ipHash}
              title={`${ip.label}…`}
              meta={
                <>
                  {plural(locale, ip.guests, h.guests)}
                  {isBlocked ? h.blockedSuffix : ""}
                </>
              }
              actions={
                !isBlocked && (
                  <button
                    type="button"
                    className={`${SMALL} ${styles.danger}`}
                    onClick={() =>
                      onAction(
                        { action: "block-ip", ipHash: ip.ipHash },
                        { title: h.blockTitle, body: h.blockBody, confirmLabel: h.block, tone: "danger" },
                        (n) => h.blocked(plural(locale, n, h.guests)),
                      )
                    }
                  >
                    {h.block}
                  </button>
                )
              }
            />
          );
        })}
      </ul>
    </>
  );
}

/** Conexiones bloqueadas, con el botón de desbloquear. */
function BlockedIps({ data, onAction }: { data: GuestOverview; onAction: GuestAction }) {
  const { m, locale } = useI18n();
  const h = m.host;
  if (!data.blockedIps.length) return null;
  return (
    <>
      <p className={styles.text}>{h.blockedIps}</p>
      <ul className={styles.list}>
        {data.blockedIps.map((b) => (
          <ListItem
            key={b.ipHash}
            title={`${b.label}…`}
            meta={h.since(formatDate(locale, b.createdAt))}
            actions={
              <button
                type="button"
                className={SMALL}
                onClick={() =>
                  onAction(
                    { action: "unblock-ip", ipHash: b.ipHash },
                    { title: h.unblockTitle, body: h.unblockBody, confirmLabel: h.unblock },
                    () => h.unblocked,
                  )
                }
              >
                {h.unblock}
              </button>
            }
          />
        ))}
      </ul>
    </>
  );
}
