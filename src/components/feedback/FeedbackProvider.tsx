"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { ToastCard } from "./ToastCard";
import styles from "./feedback.module.css";

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  /** Verbo de la acción: «Borrar», «Desvincular»… */
  confirmLabel: string;
  cancelLabel?: string;
  /** Peligrosa: el foco empieza en «Cancelar» para que un Enter despistado no borre nada. */
  tone?: "danger" | "default";
  /** Palabra que hay que escribir para habilitar la acción (p. ej. «BORRAR»). */
  typeToConfirm?: string;
}

export interface ToastOptions {
  text: string;
  tone?: "ok" | "error";
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;
type Toast = (options: ToastOptions) => void;

const ConfirmContext = createContext<Confirm | null>(null);
const ToastContext = createContext<Toast | null>(null);

/** Pide confirmación con la carátula de la app. Devuelve true si se aceptó. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm necesita <FeedbackProvider>");
  return confirm;
}

/** Muestra un aviso breve abajo (resultado de una acción o un error). */
export function useToast(): Toast {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast necesita <FeedbackProvider>");
  return toast;
}

const TOAST_MS = 4000;
const MAX_TOASTS = 3;

export interface ToastItem extends Required<ToastOptions> {
  id: number;
}

interface PendingConfirm {
  id: number;
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

/** Monta la confirmación y los avisos para toda la app (en el layout raíz). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((current) => {
          // Si ya había una abierta, se da por cancelada.
          current?.resolve(false);
          return { id: ++nextId.current, options, resolve };
        });
      }),
    [],
  );

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback<Toast>(
    ({ text, tone = "ok" }) => {
      const id = ++nextId.current;
      setToasts((list) => [...list, { id, text, tone }].slice(-MAX_TOASTS));
      // Los errores se quedan hasta que se cierran: puede que haya que leerlos con calma.
      if (tone === "ok") setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      <ToastContext.Provider value={toast}>
        {children}
        {pending && <ConfirmDialog key={pending.id} options={pending.options} onClose={close} />}
        <div className={styles.stack}>
          <div className={styles.region} role="status" aria-live="polite">
            {toasts
              .filter((t) => t.tone === "ok")
              .map((t) => (
                <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
              ))}
          </div>
          <div className={styles.region} role="alert" aria-live="assertive">
            {toasts
              .filter((t) => t.tone === "error")
              .map((t) => (
                <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
              ))}
          </div>
        </div>
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  );
}
