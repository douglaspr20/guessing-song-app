"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useI18n } from "@/i18n/client";
import styles from "./Stepper.module.css";

/**
 * Control de − valor + para números acotados (rondas, segundos). Mientras se escribe el texto es
 * libre; el valor se valida y se ajusta al rango al salir del campo o con Intro.
 */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const { m } = useI18n();
  /** Lo que se está escribiendo; null cuando el campo muestra el valor guardado. */
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const set = (v: number) => onChange(clamp(v));

  const commit = () => {
    if (draft === null) return;
    const n = Number.parseInt(draft.replace(/\D/g, ""), 10);
    // Vacío o sin cifras: se vuelve al valor de antes en lugar de saltar al mínimo.
    if (Number.isFinite(n)) set(n);
    setDraft(null);
  };

  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          setDraft(null);
          set(value - step);
        }}
        disabled={value <= min}
        aria-label={m.common.less(label)}
      >
        <Minus size={26} strokeWidth={3} aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        className={styles.value}
        value={draft ?? `${value}${unit ?? ""}`}
        onFocus={(e) => {
          setDraft(String(value));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        aria-label={label}
      />
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          setDraft(null);
          set(value + step);
        }}
        disabled={value >= max}
        aria-label={m.common.more(label)}
      >
        <Plus size={26} strokeWidth={3} aria-hidden />
      </button>
    </div>
  );
}
