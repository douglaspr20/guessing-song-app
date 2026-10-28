import { Check } from "lucide-react";
import styles from "./songs.module.css";

/** Un género como lomo de casete en la estantería: al elegirlo se saca un poco y se rellena de azafrán. */
export function GenreSpine({
  label,
  on,
  disabled,
  onToggle,
}: {
  /** Nombre visible, en el idioma de la pantalla. */
  label: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className={styles.spine} aria-pressed={on} disabled={disabled} onClick={onToggle}>
      <span className={styles.spineText}>
        {on && <Check size={16} strokeWidth={3.5} aria-hidden />}
        {label}
      </span>
    </button>
  );
}

/** La estantería de lomos. */
export const genreShelfClass = styles.shelf;
