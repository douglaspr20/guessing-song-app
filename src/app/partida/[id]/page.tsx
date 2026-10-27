import { Suspense } from "react";
import { GameClient } from "./GameClient";
import { LoadingScreen } from "./_components/StageScreen";

// El id de la partida llega en la URL: la pantalla se pinta en el navegador.
export default function GamePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GameClient />
    </Suspense>
  );
}
