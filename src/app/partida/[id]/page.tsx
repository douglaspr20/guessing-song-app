import { Suspense } from "react";
import { GameClient } from "./GameClient";
import styles from "./game.module.css";

// El id de la partida llega en la URL: la pantalla se pinta en el navegador.
export default function GamePage() {
  return (
    <Suspense
      fallback={
        <>
          <main className={styles.main}>
            <div className={styles.stage}>
              <p className={styles.stageLabel}>Rebobinando…</p>
            </div>
          </main>
        </>
      }
    >
      <GameClient />
    </Suspense>
  );
}
