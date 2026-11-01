"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * El paso «Elegir artistas» de /new: una vista a pantalla completa dentro de la misma página, así el formulario no se
 * pierde. Abrirla apila una entrada en el historial, de modo que el botón Atrás (del navegador o del móvil) vuelve
 * al formulario; «Listo» y «Volver» hacen lo mismo.
 */
export function useArtistsStep() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // La vista empieza arriba, como una página nueva; al volver, el formulario también.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [open]);

  const openStep = useCallback(() => {
    window.history.pushState({ artistsStep: true }, "");
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    if (window.history.state?.artistsStep) window.history.back();
    else setOpen(false);
  }, []);

  return { open, openStep, close };
}
