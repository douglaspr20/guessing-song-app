import { Suspense } from "react";
import { PlayClient } from "./PlayClient";

// El id de la partida llega en la URL y el estado depende de la cookie de quien juega: se pinta en el navegador.
export default function PlayPage() {
  return (
    <Suspense>
      <PlayClient />
    </Suspense>
  );
}
