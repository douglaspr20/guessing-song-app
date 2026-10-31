"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import { Notice, OfflineNotice } from "@/components/Notice";
import { Scoreboard } from "@/components/Scoreboard";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import { catalogLabel } from "@/lib/client/api";
import { trackStatus } from "@/lib/client/status";
import { useI18n } from "@/i18n/client";
import { AnswerForm } from "./_components/AnswerForm";
import { AttemptsList } from "./_components/AttemptsList";
import { BuzzBanner } from "./_components/BuzzBanner";
import { JoinPanel } from "./_components/JoinPanel";
import { FeedbackLine } from "./_components/FeedbackLine";
import { HostBuzzer } from "./_components/HostBuzzer";
import { HostSeatPicker } from "./_components/HostSeatPicker";
import { Finale } from "./_components/Finale";
import { NextActions } from "./_components/NextActions";
import { ReadyCard } from "./_components/ReadyCard";
import { RevealCard } from "./_components/RevealCard";
import { RoundCassette } from "./_components/RoundCassette";
import { ShortcutsHelp } from "./_components/ShortcutsHelp";
import { IntermissionScreen, LoadErrorScreen, LoadingScreen } from "./_components/StageScreen";
import { useGameController } from "./_hooks/useGameController";
import { useGameShortcuts } from "./_hooks/useGameShortcuts";
import styles from "./game.module.css";

/** Pantalla de juego del anfitrión: elige qué estado mostrar y compone sus piezas. */
export function GameClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { m, locale } = useI18n();
  const g = m.game;
  const ctl = useGameController(id);
  const { game, round, clock, player, rules, actions, can } = ctl;
  const [helpOpen, setHelpOpen] = useState(false);
  // Solo en la pantalla de juego: ni al cargar, ni en el entreacto, ni en el podio.
  useGameShortcuts(ctl, { enabled: !!game && !ctl.loadError && !ctl.showFinale && !ctl.intermission, onHelp: () => setHelpOpen(true) });

  if (ctl.loadError) return <LoadErrorScreen error={ctl.loadError} onRetry={ctl.retryLoad} />;
  if (!game) return <LoadingScreen />;
  if (ctl.showFinale) return <Finale game={game} />;

  const cat = catalogLabel(game.catalogNumber);
  const status = trackStatus(cat, round?.number ?? null, game.totalRounds, g, locale);
  const buzzer = ctl.buzz ? game.players.find((p) => p.id === ctl.buzz?.playerId) : undefined;

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
        {player.status === "error" && player.error && (
          <Notice on="shell" className={styles.playerError}>
            {player.error}
          </Notice>
        )}
        {ctl.liveStatus === "offline" && <OfflineNotice className={styles.playerError}>{g.realtimeLost}</OfflineNotice>}

        <div className={styles.layout}>
          <div className={styles.deck}>
            {/* El anfitrión que también juega: su botón, o su respuesta en su turno (el turno de otro lo cuenta el aviso). */}
            {round && clock.open && ctl.hostSeat && (!ctl.buzz || ctl.ownTurn) && (
              <HostBuzzer
                gameId={game.id}
                round={round}
                seat={ctl.hostSeat}
                player={game.players.find((p) => p.id === ctl.hostSeat?.playerId)}
                fetchedAt={ctl.fetchedAt}
                onChanged={() => ctl.refresh().catch(() => {})}
                musicLanguage={game.filters.language ?? null}
              />
            )}

            {ctl.buzz && !ctl.ownTurn && (
              <BuzzBanner
                buzz={ctl.buzz}
                leftMs={ctl.buzzLeftMs}
                color={buzzer?.color ?? null}
                teamName={game.format === "teams" ? (buzzer?.name ?? null) : null}
                busy={ctl.busy}
                onAward={actions.awardBuzzer}
                onFail={() => actions.resolveBuzz("fail")}
                onCancel={() => actions.resolveBuzz("cancel")}
              />
            )}

            {!round && <ReadyCard game={game} />}
            {!round && game.status !== "FINISHED" && (
              <HostSeatPicker game={game} onChanged={() => ctl.refresh().catch(() => {})} />
            )}

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
                  focusOnStart={!ctl.hostSeat}
                />
              </>
            )}

            {round && !clock.open && (
              <>
                <RevealCard game={game} round={round} />
                <FeedbackLine feedback={ctl.feedback} />
              </>
            )}

            {ctl.actionError && <Notice on="shell">{ctl.actionError}</Notice>}

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
            <JoinPanel game={game} onChanged={ctl.refresh} event={ctl.liveEvent} />
            <Scoreboard players={game.players} title={g.scoreboard(cat)} gains={ctl.gains} />
            <button type="button" className={`${ui.btn} ${ui.onShell}`} onClick={() => router.push("/")}>
              {g.exitToShelf}
            </button>
            <button type="button" className={`${ui.btn} ${ui.onShell}`} onClick={() => setHelpOpen(true)}>
              <Keyboard size={22} aria-hidden />
              {g.shortcuts}
              <kbd className={styles.key}>?</kbd>
            </button>
          </aside>
        </div>
      </main>
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </>
  );
}
