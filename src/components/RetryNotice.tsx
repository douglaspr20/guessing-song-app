"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/client";
import ui from "./ui.module.css";
import styles from "./RetryNotice.module.css";

/**
 * Algo no cargó: dice qué pasó y ofrece «Reintentar» en vez de dejar la pantalla vacía.
 * `on="shell"` sobre la carcasa índigo, `on="card"` dentro de una carátula.
 */
export function RetryNotice({
  message,
  onRetry,
  on = "shell",
}: {
  message: string;
  onRetry: () => Promise<unknown> | void;
  on?: "shell" | "card";
}) {
  const { m } = useI18n();
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`${ui.notice} ${on === "card" ? ui.noticeErrorOnCard : ui.noticeError} ${styles.notice}`} role="alert">
      <AlertTriangle size={22} aria-hidden />
      <span className={styles.text}>{message}</span>
      <button
        type="button"
        className={`${ui.btn} ${on === "card" ? ui.onCard : ui.onShell} ${styles.retry}`}
        onClick={retry}
        disabled={busy}
      >
        <RotateCcw size={20} aria-hidden />
        {busy ? m.common.retrying : m.common.retry}
      </button>
    </div>
  );
}
