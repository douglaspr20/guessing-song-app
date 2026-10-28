// Compartir el resultado: la tarjeta (imagen), la página pública (/r/…) y el panel de la pantalla final.
export const share = {
  // Tarjeta y vista previa del enlace
  andMore: (n: number) => `y ${n} más`,
  pageTitle: (headline: string, cat: string) => `${headline} · ${cat} · Adivina la canción`,
  pageDescription: (cat: string, tracks: string) => `El resultado de la partida ${cat} (${tracks}). Graba la tuya, sin cuenta.`,
  cardAlt: (headline: string, cat: string) => `Tarjeta del resultado de ${cat}: ${headline}`,
  // Página pública
  ctaTitle: "¿Y tú, adivinas la canción?",
  ctaLede: "Graba tu propia partida: se juega con una pantalla y los móviles de la familia, sin cuenta.",
  ctaPlay: "Jugar sin cuenta",
  ctaJoin: "Unirme con un código",
  // Panel de la pantalla final
  button: "Compartir resultado",
  preparing: "Preparando…",
  panelTitle: "Compartir este resultado",
  privacy: "Cualquiera con el enlace verá los nombres y los puntos de esta partida (nunca las canciones).",
  previewAlt: "Vista previa de la tarjeta del resultado",
  linkLabel: "Enlace al resultado",
  copyLink: "Copiar enlace",
  linkCopied: "Enlace copiado.",
  nativeShare: "Compartir…",
  shareImage: "Compartir imagen",
  downloadWide: "Descargar apaisada",
  downloadTall: "Descargar vertical",
  shareText: (headline: string, cat: string) => `${headline} en ${cat} · Adivina la canción`,
  close: "Cerrar",
  cantShare: (detail: string) => `No se pudo compartir. ${detail}`,
  stop: "Dejar de compartir",
  stopTitle: "¿Dejar de compartir este resultado?",
  stopBody: "El enlace y la imagen dejan de funcionar. Quien ya descargó la imagen la conserva.",
  stopConfirm: "Dejar de compartir",
  stopped: "Ya no se comparte este resultado.",
};
