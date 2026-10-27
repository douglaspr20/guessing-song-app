"use client";

import { useCallback, useRef } from "react";

/**
 * Relee el estado de uno en uno: si llega otro aviso mientras se lee, se vuelve a leer al acabar
 * (así una ráfaga de avisos del tiempo real no lanza diez lecturas a la vez ni deja la última sin hacer).
 */
export function useSerializedRefresh(refresh: () => Promise<unknown>) {
  const reading = useRef(false);
  const readAgain = useRef(false);
  return useCallback(async () => {
    if (reading.current) {
      readAgain.current = true;
      return;
    }
    reading.current = true;
    try {
      do {
        readAgain.current = false;
        await refresh().catch(() => {});
      } while (readAgain.current);
    } finally {
      reading.current = false;
    }
  }, [refresh]);
}
