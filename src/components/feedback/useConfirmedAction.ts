"use client";

import { useCallback } from "react";
import { errorText } from "@/lib/client/api";
import { useConfirm, useToast, type ConfirmOptions } from "./FeedbackProvider";

interface ConfirmedAction<T> {
  /** Si se da, primero se pide confirmación; si la persona cancela no pasa nada. */
  question?: ConfirmOptions;
  run: () => Promise<T>;
  /** Aviso al terminar bien (puede depender de lo que devolvió la API). */
  done?: string | ((result: T) => string);
  /** Se ejecuta al final, haya ido bien o mal (normalmente, recargar la lista). */
  after?: () => unknown;
}

/**
 * La secuencia de las acciones de los paneles: confirmar → llamar a la API → avisar del resultado → recargar.
 * Devuelve true si la acción se hizo.
 */
export function useConfirmedAction() {
  const confirm = useConfirm();
  const toast = useToast();

  return useCallback(
    async <T>({ question, run, done, after }: ConfirmedAction<T>): Promise<boolean> => {
      if (question && !(await confirm(question))) return false;
      let ok = false;
      try {
        const result = await run();
        const text = typeof done === "function" ? done(result) : done;
        if (text) toast({ text });
        ok = true;
      } catch (err) {
        toast({ text: errorText(err), tone: "error" });
      }
      await after?.();
      return ok;
    },
    [confirm, toast],
  );
}
