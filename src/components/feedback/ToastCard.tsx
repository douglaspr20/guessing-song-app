"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { ToastItem } from "./FeedbackProvider";
import styles from "./feedback.module.css";

/** Un aviso breve abajo: verde si salió bien; rojo (con botón de cerrar) si falló. */
export function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { m } = useI18n();
  return (
    <div className={`${styles.toast} ${styles[toast.tone]}`}>
      {toast.tone === "error" ? <AlertTriangle size={22} aria-hidden /> : <CheckCircle2 size={22} aria-hidden />}
      <span className={styles.toastText}>{toast.text}</span>
      {toast.tone === "error" && (
        <button type="button" className={styles.close} onClick={() => onDismiss(toast.id)} aria-label={m.common.closeNotice}>
          <X size={22} aria-hidden />
        </button>
      )}
    </div>
  );
}
