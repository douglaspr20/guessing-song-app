import controls from "./styles/controls.module.css";

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

/**
 * Elegir una opción entre dos o tres: botones pegados con `aria-pressed`, el elegido relleno de tinta.
 * `fill` reparte el ancho a partes iguales (y en el móvil deja partir el texto).
 */
export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
  fill = false,
  className = "",
}: {
  /** Nombre del grupo para lectores de pantalla. */
  label: string;
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  fill?: boolean;
  className?: string;
}) {
  return (
    <div className={`${controls.segment} ${fill ? controls.segmentFill : ""} ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          disabled={o.disabled}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
