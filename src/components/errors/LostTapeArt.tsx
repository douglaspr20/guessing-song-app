"use client";

import { useI18n } from "@/i18n/client";
import styles from "./errors.module.css";

const ghost = { fill: "none", stroke: "var(--card-ink-soft)", strokeWidth: 4, strokeDasharray: "10 8" } as const;

/**
 * Cartel de «Se busca» pegado con cinta de carrocero: donde debería estar el casete solo queda
 * su silueta punteada, y un cabo de cinta se escapa por debajo.
 */
export function LostTapeArt({ catalog = "C-404" }: { catalog?: string }) {
  const { m } = useI18n();
  const e = m.common.errorPage;
  return (
    <div className={styles.poster}>
      <span className={`${styles.masking} ${styles.maskingLeft}`} aria-hidden />
      <span className={`${styles.masking} ${styles.maskingRight}`} aria-hidden />
      <div className={styles.posterStripes} />
      <div className={styles.posterBody}>
        <p className={styles.wanted}>{e.wanted}</p>
        <svg className={styles.silhouette} viewBox="0 0 360 220" role="img" aria-label={e.silhouette}>
          <rect x="6" y="6" width="348" height="208" rx="22" style={ghost} />
          <rect x="34" y="26" width="292" height="52" rx="6" style={ghost} />
          <rect x="80" y="98" width="200" height="66" rx="33" style={ghost} />
          <circle cx="130" cy="131" r="21" style={ghost} />
          <circle cx="230" cy="131" r="21" style={ghost} />
          <path d="M96 214 L116 182 H244 L264 214" style={ghost} />
          <text
            x="180"
            y="146"
            textAnchor="middle"
            style={{ fill: "var(--tomato-deep)", fontFamily: "var(--font-script)", fontWeight: 700, fontSize: 52 }}
          >
            ?
          </text>
        </svg>
        <p className={styles.missingName}>{e.cassette(catalog)}</p>
        <p className={styles.missingNote}>{e.lastSeen}</p>
        <p className={styles.reward}>{e.reward}</p>
      </div>
      <svg className={styles.loose} viewBox="0 0 300 170" aria-hidden>
        <path
          d="M14 6 C 70 54, 6 108, 84 120 S 170 52, 214 112 S 270 168, 296 150"
          style={{ fill: "none", stroke: "#5b3a1e", strokeWidth: 7, strokeLinecap: "round" }}
        />
      </svg>
    </div>
  );
}
