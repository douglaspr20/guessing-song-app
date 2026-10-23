"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { TopBar } from "../TopBar";

type Register = (id: string, text: ReactNode) => () => void;

const BandContext = createContext<Register | null>(null);

/**
 * La banda de rayas vive una sola vez en el layout raíz; cada pantalla solo dice qué va en su
 * etiqueta de estado con <BandStatus>. Se guarda una lista y manda la última pantalla que habló:
 * Next mantiene vivas las pantallas ocultas (<Activity>) y la que se oculta puede despedirse
 * después de que la nueva ya se presentó, así que nadie borra el texto de otro.
 */
export function BandProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<{ id: string; text: ReactNode }[]>([]);

  const register = useCallback<Register>((id, text) => {
    setEntries((list) => [...list.filter((e) => e.id !== id), { id, text }]);
    return () => setEntries((list) => list.filter((e) => e.id !== id));
  }, []);

  return (
    <BandContext.Provider value={register}>
      <TopBar status={entries.at(-1)?.text} />
      {children}
    </BandContext.Provider>
  );
}

/** Pone `text` en la etiqueta de estado de la banda mientras esta pantalla está visible. */
export function BandStatus({ text }: { text?: ReactNode }) {
  const register = useContext(BandContext);
  const id = useId();
  useEffect(() => {
    if (!register || text === undefined || text === null || text === "") return;
    return register(id, text);
  }, [register, id, text]);
  return null;
}
