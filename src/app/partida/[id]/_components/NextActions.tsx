import Link from "next/link";
import { Settings2, SkipForward, Trophy } from "lucide-react";
import ui from "@/components/ui.module.css";
import styles from "../game.module.css";

/** Botones para avanzar con la ronda cerrada (o antes de la primera): empezar, siguiente pista o ver el podio. */
export function NextActions({
  gameId,
  hasRound,
  finished,
  busy,
  playerReady,
  onNext,
  onFinale,
}: {
  gameId: string;
  hasRound: boolean;
  finished: boolean;
  busy: boolean;
  playerReady: boolean;
  onNext: () => void;
  onFinale: () => void;
}) {
  if (finished) {
    return (
      <div className={styles.nextRow}>
        <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={onFinale}>
          <Trophy size={28} aria-hidden />
          Ver el podio
        </button>
      </div>
    );
  }

  return (
    <div className={styles.nextRow}>
      {!hasRound && (
        // Antes de la primera pista todavía se pueden cambiar jugadores, rondas y filtros.
        <Link href={`/nueva?editar=${gameId}`} className={`${ui.btn} ${ui.onShell} ${ui.big}`}>
          <Settings2 size={26} aria-hidden />
          Editar ajustes
        </Link>
      )}
      <button
        type="button"
        className={`${ui.btn} ${ui.primary} ${ui.big}`}
        onClick={onNext}
        disabled={busy || !playerReady}
      >
        <SkipForward size={28} aria-hidden />
        {hasRound ? "Siguiente pista" : "Empezar"}
      </button>
    </div>
  );
}
