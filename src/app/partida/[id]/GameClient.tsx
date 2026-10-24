"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, Keyboard } from "lucide-react";
import { Scoreboard } from "@/components/Scoreboard";
import { BandStatus } from "@/components/band/BandStatus";
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
import { ShortcutsHelp } from "./_components/ShortcutsHelp";
import { IntermissionScreen, LoadErrorScreen, LoadingScreen } from "./_components/StageScreen";
import { useGameController } from "./_lib/useGameController";
import { useGameShortcuts } from "./_lib/useGameShortcuts";
import styles from "./game.module.css";

/** Pantalla de juego del anfitrión: elige qué estado mostrar y compone sus piezas. */
export function GameClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ctl = useGameController(id);
  const { game, round, clock, player, rules, actions, can } = ctl;
  const [helpOpen, setHelpOpen] = useState(false);
  // Solo en la pantalla de juego: ni al cargar, ni en el entreacto, ni en el podio.
  useGameShortcuts(ctl, { enabled: !!game && !ctl.loadError && !ctl.showFinale && !ctl.intermission, onHelp: () => setHelpOpen(true) });

  if (ctl.loadError) return <LoadErrorScreen error={ctl.loadError} onRetry={ctl.retryLoad} />;
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

  return (
    <>
      <BandStatus text={status} />
      <main className={styles.main}>
        {player.status === "error" && player.error && <ErrorNotice className={styles.playerError} message={player.error} />}

        <div className={styles.layout}>
          <div className={styles.deck}>
            {!round && <ReadyCard game={game} />}

            {round && clock.open && (
              <>
                <RoundCassette round={round} clock={clock} rules={rules} running={player.phase === "playing"} />
                <AnswerForm
                  key={round.id}
                  players={ctl.seats}
                  selected={ctl.selectedPlayer}
                  onSelect={ctl.selectPlayer}
                  clock={clock}
                  feedback={ctl.feedback}
                  busy={ctl.busy}
                  can={can}
                  onSubmit={actions.submitGuess}
                  onReplay={actions.replay}
                  onTogglePause={actions.togglePause}
                  onReveal={actions.reveal}
                  onAwardTitle={actions.awardTitle}
                  onAwardArtist={actions.awardArtist}
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
                finished={ctl.finished}
                canNext={can.next}
                onNext={actions.startNext}
                onFinale={ctl.openFinale}
              />
            )}

            {round && (
              <AttemptsList
                round={round}
                guesses={ctl.guesses}
                open={clock.open}
                artistDeadlineMs={rules.hintAtMs.artist}
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
            <button type="button" className={`${ui.btn} ${ui.onShell}`} onClick={() => setHelpOpen(true)}>
              <Keyboard size={22} aria-hidden />
              Atajos
              <kbd className={styles.key}>?</kbd>
            </button>
          </aside>
        </div>
      </main>
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
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
