import { useI18n } from "@/i18n/client";
import type { HintMark } from "@/lib/client/hints";
import styles from "./HintMarks.module.css";

export type { HintMark };

/**
 * Las tres marcas de pista: el segundo en que sale cada una y, ya desbloqueada, lo que dice.
 * En el casete de la tele van sobre la carcasa; `compact` es la versión del móvil, sobre la tarjeta clara.
 */
export function HintMarks({ hints, compact = false, className }: { hints: HintMark[]; compact?: boolean; className?: string }) {
  const { m } = useI18n();
  return (
    <ol className={`${styles.marks} ${compact ? styles.compact : styles.onShell} ${className ?? ""}`} aria-label={m.common.hints}>
      {hints.map((h) => (
        <li key={h.key} className={`${styles.mark} ${h.unlocked ? styles.markOn : ""}`}>
          {h.at} · {h.label}
          <strong>{h.unlocked ? (h.value ?? m.common.unavailable) : "—"}</strong>
        </li>
      ))}
    </ol>
  );
}
