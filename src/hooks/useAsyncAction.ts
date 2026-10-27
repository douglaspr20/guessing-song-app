"use client";

import { useCallback, useState } from "react";
import { errorText } from "@/lib/client/api";

/**
 * Estado de un formulario que llama a la API: `busy` mientras espera y `error` con el texto del fallo.
 * `run(fn)` devuelve lo que devuelva `fn`, o `undefined` si falló (el error ya queda en `error`).
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(errorText(err));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}
