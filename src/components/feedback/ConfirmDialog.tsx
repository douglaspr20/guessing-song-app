"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import ui from "../ui.module.css";
import type { ConfirmOptions } from "./FeedbackProvider";
import styles from "./feedback.module.css";

/** La confirmación con la carátula de la app (`<dialog>` modal); las peligrosas pueden pedir escribir una palabra. */
export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const ids = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const { m } = useI18n();
  const { title, body, confirmLabel, cancelLabel = m.common.cancel, tone = "default", typeToConfirm } = options;
  const ready = !typeToConfirm || typed.trim().toUpperCase() === typeToConfirm.toUpperCase();

  // showModal: el navegador atrapa el foco, cierra con Esc y deja el resto de la página inerte.
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      opener?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${ids}-title`}
      aria-describedby={body ? `${ids}-body` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
    >
      <div className={ui.cardStripes} />
      <form
        className={styles.body}
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onClose(true);
        }}
      >
        <h2 className={styles.title} id={`${ids}-title`}>
          {title}
        </h2>
        {body && (
          <div className={styles.text} id={`${ids}-body`}>
            {body}
          </div>
        )}
        {typeToConfirm && (
          <label className={styles.typeField}>
            <span className={styles.typeLabel}>
              {m.common.typeToConfirmBefore} <b>{typeToConfirm}</b> {m.common.typeToConfirmAfter}
            </span>
            <input
              className={styles.typeInput}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
            />
          </label>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={`${ui.btn} ${ui.onCard}`}
            onClick={() => onClose(false)}
            autoFocus={tone === "danger" && !typeToConfirm}
          >
            {cancelLabel}
          </button>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={!ready}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
