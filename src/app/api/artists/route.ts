import { connection, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/access/owner";
import { clientInfo } from "@/lib/access/request";
import { ARTISTS_LIMITS, artistSourceFor, listArtists } from "@/lib/artists/directory";
import { db } from "@/lib/db";
import { AppError, handle } from "@/lib/errors";
import { itunesSource } from "@/lib/game/service";
import { searchArtists } from "@/lib/spotify/sources";

const list = (v: string | null) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

/** Un año razonable o nada (la época del listado). */
const year = (v: string | null) => {
  const n = Number(v);
  return v && Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : undefined;
};

/**
 * El directorio de artistas para elegir con quién jugar.
 * Query: ?source=spotify|itunes&genres=pop,salsa&language=es-latam&yearFrom=1980&yearTo=1989&q=sha&page=1.
 * Con `spotify` (y la cuenta con Spotify conectado) salen los artistas de Spotify con su foto; si no, los de iTunes con
 * la portada de su canción. La época solo filtra con iTunes (por el año de cada canción); Spotify la ignora.
 */
export const GET = handle(async (req: NextRequest) => {
  await connection();
  const owner = await requireOwner();
  const { ipHash } = await clientInfo();
  const key = `artists:${ipHash}`;
  const recent = await db.loginAttempt.count({
    where: { ipHash: key, createdAt: { gt: new Date(Date.now() - ARTISTS_LIMITS.windowMs) } },
  });
  if (recent >= ARTISTS_LIMITS.perIp) throw new AppError("TOO_MANY_ATTEMPTS", 429);
  await db.loginAttempt.create({ data: { ipHash: key, ok: true } });

  const params = req.nextUrl.searchParams;
  // Una partida en modo abierto pide iTunes aunque la cuenta tenga Spotify.
  const source = params.get("source") === "spotify" ? await artistSourceFor(owner) : "itunes";

  return Response.json(
    await listArtists(
      {
        source,
        userId: owner.kind === "user" ? owner.userId : undefined,
        genres: list(params.get("genres")),
        language: params.get("language") || undefined,
        yearFrom: year(params.get("yearFrom")),
        yearTo: year(params.get("yearTo")),
        q: (params.get("q") ?? "").slice(0, 60),
        page: Math.max(1, Number(params.get("page")) || 1),
      },
      { itunes: itunesSource, spotify: searchArtists },
    ),
  );
});
