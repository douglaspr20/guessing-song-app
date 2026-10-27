import type { ReactNode } from "react";
import form from "./styles/form.module.css";

/** Campo de formulario: la etiqueta condensada encima, el control y, si hace falta, una pista debajo. */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`${form.field} ${className}`}>
      <span className={form.label}>{label}</span>
      {children}
      {hint && <span className={form.hint}>{hint}</span>}
    </label>
  );
}
