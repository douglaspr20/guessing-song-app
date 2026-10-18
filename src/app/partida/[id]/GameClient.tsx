"use client";

import { useParams, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Scoreboard } from "@/components/Scoreboard";
import { TopBar } from "@/components/TopBar";
import ui from "@/components/ui.module.css";
import { catalogLabel } from "@/lib/client/api";
import { AnswerForm } from "./_components/AnswerForm";
import { AttemptsList } from "./_components/AttemptsList";
import { FeedbackLine } from "./_components/FeedbackLine";
import { Finale } from "./_components/Finale";
import { NextActions } from "./_components/NextActions";
import { ReadyCard } from "./_components/ReadyCard";
import { RevealCard } from "./_components/RevealCard";
import { RoundCassette } from "./_components/RoundCassette";
import { IntermissionScreen, LoadErrorScreen, LoadingScreen } from "./_components/StageScreen";
import { useGameController } from "./_lib/useGameController";
import styles from "./game.module.css";

/** Pantalla de juego del anfitrión: elige qué estado mostrar y compone sus piezas. */
export function GameClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ctl = useGameController(id);
  const { game, round, clock, player, actions } = ctl;

  if (ctl.loadError) return <LoadErrorScreen message={ctl.loadError} />;
  if (!game) return <LoadingScreen />;
  if (ctl.showFinale) return <Finale game={game} />;

  const cat = catalogLabel(game.catalogNumber);
  const status = round ? `${cat} · Pista ${round.number} de ${game.totalRounds}` : `${cat} · ${game.totalRounds} pistas`;

  if (ctl.intermission) {
    const secondsLeft = ctl.now ? Math.min(3, Math.max(1, Math.ceil((ctl.intermission.endsAt - ctl.now) / 1000))) : 3;
    return (
      <IntermissionScreen
        status={status}
        number={ctl.intermission.number}
        totalRounds={game.totalRounds}
        secondsLeft={secondsLeft}
      />
    );
  }

  const playerReady = player.status === "ready";
  const playing = player.phase === "playing";

  return (
    <>
      <TopBar status={status} />
      <main className={styles.main}>
        {player.status === "error" && player.error && <ErrorNotice className={styles.playerError} message={player.error} />}

        <div className={styles.layout}>
          <div className={styles.deck}>
            {!round && <ReadyCard game={game} />}

            {round && clock.open && (
              <>
                <RoundCassette round={round} clock={clock} running={playing} />
                <AnswerForm
                  key={round.id}
                  players={game.players}
                  clock={clock}
                  feedback={ctl.feedback}
                  busy={ctl.busy}
                  playerReady={playerReady}
                  playing={playing}
                  onSubmit={actions.submitGuess}
                  onReplay={actions.replay}
                  onTogglePause={actions.togglePause}
                  onReveal={actions.reveal}
                />
              </>
            )}

            {round && !clock.open && (
              <>
                <RevealCard game={game} round={round} />
                <FeedbackLine feedback={ctl.feedback} />
              </>
            )}

            {ctl.actionError && <ErrorNotice message={ctl.actionError} />}

            {(!round || !clock.open) && (
              <NextActions
                gameId={game.id}
                hasRound={!!round}
                finished={game.status === "FINISHED" || game.currentRound >= game.totalRounds}
                busy={ctl.busy}
                playerReady={playerReady}
                onNext={actions.startNext}
                onFinale={ctl.openFinale}
              />
            )}

            {round && (
              <AttemptsList
                round={round}
                guesses={ctl.guesses}
                open={clock.open}
                busy={ctl.busy}
                onAccept={actions.acceptGuess}
              />
            )}
          </div>

          <aside className={styles.side}>
            <Scoreboard players={game.players} title={`Marcador · ${cat}`} gains={ctl.gains} />
            <button type="button" className={`${ui.btn} ${ui.onShell}`} onClick={() => router.push("/")}>
              Salir a la estantería
            </button>
          </aside>
        </div>
      </main>
    </>
  );
}

function ErrorNotice({ message, className = "" }: { message: string; className?: string }) {
  return (
    <p className={`${ui.notice} ${ui.noticeError} ${className}`} role="alert">
      <AlertTriangle size={20} aria-hidden />
      {message}
    </p>
  );
}
