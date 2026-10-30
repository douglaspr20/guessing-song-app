"use client";

import { useState } from "react";
import { RetryNotice } from "@/components/RetryNotice";
import { Segmented } from "@/components/Segmented";
import { useI18n } from "@/i18n/client";
import { useHostData } from "../_hooks/useHostData";
import type { Stats } from "../_lib/types";
import styles from "../host.module.css";
import { Section, Stat } from "./PanelBits";

type Window = Stats["window"];

/** «Cómo se usa»: el embudo del juego (invitados → partidas creadas → empezadas → terminadas) y la actividad diaria. */
export function StatsSection() {
  const { m, locale } = useI18n();
  const h = m.host;
  const [period, setPeriod] = useState<Window>("7d");
  const { data, error, reload } = useHostData<Stats>(`/api/host/stats?window=${period}`);
  const percent = (n: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(n);

  return (
    <Section title={h.statsTitle}>
      <Segmented<Window>
        label={h.statsWindow}
        value={period}
        onChange={setPeriod}
        options={[
          { value: "24h", label: h.window24h },
          { value: "7d", label: h.window7d },
          { value: "30d", label: h.window30d },
        ]}
      />

      {!data ? (
        error && <RetryNotice on="card" message={h.cantLoadStats(error)} onRetry={reload} />
      ) : (
        <>
          <div className={styles.stats}>
            <Stat value={data.guests} label={h.statsNewGuests} />
            <Stat value={data.funnel.created} label={h.statsCreated} />
            <Stat value={data.funnel.started} label={h.statsStarted} />
            <Stat value={data.funnel.finished} label={h.statsFinished} />
            <Stat value={data.abandoned} label={h.statsAbandoned} />
            <Stat value={data.replays} label={h.statsReplays} />
            <Stat value={data.phones.joined} label={h.statsPhones} />
            <Stat value={data.phones.followed} label={h.statsFollowed} />
            <Stat value={data.shared} label={h.statsShared} />
            <Stat value={data.reclaimed} label={h.statsReclaimed} />
          </div>

          <div className={styles.rates}>
            {data.rates.started === null ? (
              <span className={styles.itemMeta}>{h.statsNoRate}</span>
            ) : (
              <>
                <span>{h.statsStartedRate(percent(data.rates.started))}</span>
                {data.rates.finished !== null && <span>{h.statsFinishedRate(percent(data.rates.finished))}</span>}
              </>
            )}
            <span className={styles.itemMeta}>{h.statsAbandonedNote}</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{h.statsByMode} · {h.statsByFormat}</caption>
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col">{h.statsCreated}</th>
                  <th scope="col">{h.statsStarted}</th>
                  <th scope="col">{h.statsFinished}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    [h.statsOpen, data.byMode.open],
                    [h.statsSpotify, data.byMode.spotify],
                    [h.statsSolo, data.byFormat.solo],
                    [h.statsTeams, data.byFormat.teams],
                  ] as const
                ).map(([label, f]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{f.created}</td>
                    <td>{f.started}</td>
                    <td>{f.finished}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>{h.statsDaily}</caption>
              <thead>
                <tr>
                  <th scope="col">{h.statsDay}</th>
                  <th scope="col">{h.statsCreated}</th>
                  <th scope="col">{h.statsFinished}</th>
                </tr>
              </thead>
              <tbody>
                {[...data.daily].reverse().map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{d.day}</th>
                    <td>{d.created}</td>
                    <td>{d.finished}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.itemMeta}>{h.statsVercelNote}</p>
        </>
      )}
    </Section>
  );
}
