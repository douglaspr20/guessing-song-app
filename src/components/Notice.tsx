import type { ReactNode } from "react";
import { AlertTriangle, WifiOff } from "lucide-react";
import ui from "./ui.module.css";

/**
 * Aviso de error: `on="card"` dentro de una carátula, `on="shell"` sobre la carcasa índigo.
 * Por defecto es una alerta (`role="alert"`); los avisos de estado que no interrumpen usan `role="status"`.
 */
export function Notice({
  children,
  on = "card",
  icon = <AlertTriangle size={20} aria-hidden />,
  role = "alert",
  id,
  className = "",
}: {
  children: ReactNode;
  on?: "card" | "shell";
  icon?: ReactNode;
  role?: "alert" | "status";
  id?: string;
  className?: string;
}) {
  return (
    <p id={id} className={`${ui.notice} ${on === "card" ? ui.noticeErrorOnCard : ui.noticeError} ${className}`} role={role}>
      {icon}
      {children}
    </p>
  );
}

/** «Conexión inestable»: la tele y el móvil lo muestran cuando el tiempo real se corta. */
export function OfflineNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Notice on="shell" role="status" icon={<WifiOff size={20} aria-hidden />} className={className}>
      {children}
    </Notice>
  );
}
