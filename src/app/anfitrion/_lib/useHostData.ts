"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";

/** Mensaje para la familia a partir de cualquier error de la API. */
export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : "No se pudo conectar. Prueba otra vez.";

/**
 * Carga datos del panel. Si fallan, `error` lo dice y `reload` reintenta: una sección nunca
 * queda vacía en silencio como si no hubiera nada.
 */
export function useHostData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api<T>(url));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [url]);

  useEffect(() => {
    // Primera carga al montar (viene del servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { data, error, reload, setData };
}
