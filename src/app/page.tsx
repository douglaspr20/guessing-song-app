import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentOwner } from "@/lib/access/owner";
import { getAccessStatus } from "@/lib/access/status";
import type { AccessStatus, GameList } from "@/lib/client/api";
import { listGames } from "@/lib/game/service";
import { HomeClient, HomeLoading } from "./_components/HomeClient";

/**
 * Portada. Quién es y sus casetes se leen aquí, en el servidor (lee la cookie de sesión, así que va tras un límite de
 * Suspense): la estantería aparece de una vez. Es la única fuente de esos datos: tras un cambio (borrar, entrar,
 * salir) el navegador pide `router.refresh()` y esto se vuelve a leer.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeData />
    </Suspense>
  );
}

async function HomeData() {
  await connection(); // en tiempo de petición: lee la cookie y la hora (caducidad de la sesión)
  let access: AccessStatus | null = null;
  let list: GameList | null = null;
  let listFailed = false;
  try {
    access = await getAccessStatus();
  } catch (err) {
    unstable_rethrow(err); // lo que Next usa por dentro (p. ej. al prerenderizar) no se toca
    // La BD no contestó: la portada lo dice y ofrece reintentar.
  }
  if (access?.user || access?.guest) {
    try {
      const owner = await currentOwner();
      if (owner) list = await listGames(owner, 12);
    } catch (err) {
      unstable_rethrow(err);
      listFailed = true;
    }
  }
  return <HomeClient access={access} list={list} listFailed={listFailed} />;
}
