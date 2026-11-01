import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentOwner } from "@/lib/access/owner";
import { artistSourceFor } from "@/lib/artists/directory";
import { ArtistsClient } from "./_components/ArtistsClient";

/**
 * El directorio de artistas. De dónde salen (Spotify con la cuenta conectada, si no iTunes) se decide aquí, en el
 * servidor: el listado pide una sola vez y a la fuente buena.
 */
export default function ArtistsPage() {
  return (
    <Suspense fallback={<ArtistsClient source={null} />}>
      <ArtistsData />
    </Suspense>
  );
}

async function ArtistsData() {
  await connection(); // en tiempo de petición: lee la cookie y la hora (caducidad de la sesión)
  let source: "spotify" | "itunes" = "itunes";
  try {
    source = await artistSourceFor(await currentOwner());
  } catch (err) {
    unstable_rethrow(err); // lo que Next usa por dentro (p. ej. al prerenderizar) no se toca
    // Invitado bloqueado o BD caída: iTunes, y el listado ya dirá si no puede cargar.
  }
  return <ArtistsClient source={source} />;
}
