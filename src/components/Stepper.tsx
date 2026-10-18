import { Minus, Plus } from 'lucide-react';
import styles from './Stepper.module.css';

/** Control de − valor + para números acotados (rondas, segundos). */
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
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div
      className={styles.stepper}
      role='group'
      aria-label={label}
    >
      <button
        type='button'
        className={styles.btn}
        onClick={() => set(value - step)}
        disabled={value <= min}
        aria-label={`Menos ${label.toLowerCase()}`}
      >
        <Minus
          size={26}
          strokeWidth={3}
          aria-hidden
        />
      </button>
      <input
        type='text'
        className={styles.value}
        value={`${value}${unit ?? ''}`}
        onChange={(e) => set(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        aria-label={label}
      />
      {/* <output
        className={styles.value}
        aria-live='polite'
      >
        {value}
        {unit && <small>{unit}</small>}
      </output> */}
      <button
        type='button'
        className={styles.btn}
        onClick={() => set(value + step)}
        disabled={value >= max}
        aria-label={`Más ${label.toLowerCase()}`}
      >
        <Plus
          size={26}
          strokeWidth={3}
          aria-hidden
        />
      </button>
    </div>
  );
}
