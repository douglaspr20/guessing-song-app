"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/lib/client/api";

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
      setError(errorText(err));
    }
  }, [url]);

  useEffect(() => {
    // Primera carga al montar (viene del servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { data, error, reload, setData };
}
