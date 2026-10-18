import { DECADES, GENRES, LANGUAGES } from "@/lib/spotify/catalog";

/** Opciones disponibles para los filtros de la partida. */
export function GET() {
  return Response.json({ genres: GENRES, languages: LANGUAGES, decades: DECADES });
}
