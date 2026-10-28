/**
 * Qué URL llega a Vercel Analytics y Speed Insights. Se quitan los datos que identifican algo concreto:
 * ids de partida, códigos de unión y códigos de resultados compartidos pasan a ser la ruta genérica, y se borran los parámetros
 * (`?edit=<id>`, `?error=…`). El panel del anfitrión no se mide nunca.
 */
const ROUTES: [RegExp, string][] = [
  [/^\/game\/[^/]+/, "/game/[id]"],
  [/^\/play\/[^/]+/, "/play/[gameId]"],
  [/^\/join\/[^/]+/, "/join/[code]"],
  // El código del enlace de un resultado compartido es secreto: no sale de nuestra app.
  [/^\/r\/[^/]+/, "/r/[token]"],
];

/** La URL sin datos personales, o null si esa página no se mide. */
export function anonymizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.pathname === "/host" || url.pathname.startsWith("/host/")) return null;
  let path = url.pathname;
  for (const [pattern, route] of ROUTES) path = path.replace(pattern, route);
  return `${url.origin}${path}`;
}

/** Filtro común para los dos paquetes de Vercel: misma forma de evento (`url`) y null para no enviar. */
export function beforeSend<T extends { url: string }>(event: T): T | null {
  const url = anonymizeUrl(event.url);
  return url ? { ...event, url } : null;
}
