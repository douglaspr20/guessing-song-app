"use client";

import { useEffect, useId, useRef } from "react";
import ui from "@/components/ui.module.css";
import dialogStyles from "@/components/feedback/feedback.module.css";
import { SHORTCUT_HELP } from "../_lib/shortcuts";
import styles from "../game.module.css";

const BACK_KEYCODES = [461, 10009];

/** La chuleta de atajos: misma carátula que las confirmaciones; se cierra con Esc, Atrás o el botón. */
export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`${dialogStyles.dialog} ${styles.helpDialog}`}
      aria-labelledby={titleId}
      // En desarrollo React monta, desmonta y vuelve a montar: el `close` del desmontaje intermedio
      // llega con el diálogo ya reabierto y no debe cerrarlo.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      onKeyDown={(e) => {
        // El Atrás del mando de la tele no es Esc: también cierra.
        if (e.key === "GoBack" || e.key === "BrowserBack" || BACK_KEYCODES.includes(e.keyCode)) {
          e.preventDefault();
          ref.current?.close();
        }
      }}
    >
      <div className={ui.cardStripes} />
      <div className={dialogStyles.body}>
        <h2 className={dialogStyles.title} id={titleId}>
          Atajos para la tele
        </h2>
        <table className={styles.helpTable}>
          <thead>
            <tr>
              <th scope="col">Qué hace</th>
              <th scope="col">Teclado</th>
              <th scope="col">Mando</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUT_HELP.map((row) => (
              <tr key={row.action}>
                <td>{row.action}</td>
                <td>
                  {row.keys.map((k) => (
                    <kbd key={k} className={styles.helpKey}>
                      {k}
                    </kbd>
                  ))}
                </td>
                <td>
                  {row.color && <span className={styles.remoteDot} data-color={row.color} aria-hidden />} {row.remote}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.fieldLabel}>Mientras escribes, las letras se escriben: Esc o Atrás sueltan el campo.</p>
        <div className={dialogStyles.actions}>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={() => ref.current?.close()} autoFocus>
            Entendido
          </button>
        </div>
      </div>
    </dialog>
  );
}
