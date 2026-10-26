"use client";

import { useConfirm, useToast, type ConfirmOptions } from "@/components/feedback/FeedbackProvider";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { formatDate, plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import type { GuestOverview } from "../_lib/types";
import { errorMessage, useHostData } from "../_lib/useHostData";
import styles from "../host.module.css";
import { Section, Stat } from "./PanelBits";

type Flags = Partial<Pick<GuestOverview, "openModePaused" | "guestSignupsPaused">>;

export function GuestsSection() {
  const { m, locale } = useI18n();
  const h = m.host;
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
          className={`${ui.btn} ${ui.onCard} ${styles.small}`}
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
          className={`${ui.btn} ${ui.onCard} ${styles.small} ${styles.danger}`}
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

      {data.topIps.length > 0 && (
        <>
          <p className={styles.text}>{h.topIps}</p>
          <ul className={styles.list}>
            {data.topIps.map((ip) => {
              const isBlocked = data.blockedIps.some((b) => b.ipHash === ip.ipHash);
              return (
                <li key={ip.ipHash} className={styles.item}>
                  <span className={styles.itemMain}>
                    <span className={styles.itemTitle}>{ip.label}…</span>
                    <span className={styles.itemMeta}>
                      {plural(locale, ip.guests, h.guests)}
                      {isBlocked ? h.blockedSuffix : ""}
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
                            title: h.blockTitle,
                            body: h.blockBody,
                            confirmLabel: h.block,
                            tone: "danger",
                          },
                          (n) => h.blocked(plural(locale, n, h.guests)),
                        )
                      }
                    >
                      {h.block}
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
          <p className={styles.text}>{h.blockedIps}</p>
          <ul className={styles.list}>
            {data.blockedIps.map((b) => (
              <li key={b.ipHash} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{b.label}…</span>
                  <span className={styles.itemMeta}>{h.since(formatDate(locale, b.createdAt))}</span>
                </span>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                  onClick={() =>
                    action(
                      { action: "unblock-ip", ipHash: b.ipHash },
                      { title: h.unblockTitle, body: h.unblockBody, confirmLabel: h.unblock },
                      () => h.unblocked,
                    )
                  }
                >
                  {h.unblock}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
