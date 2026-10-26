"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { Podium } from "@/components/Podium";
import { RetryNotice } from "@/components/RetryNotice";
import { Scoreboard } from "@/components/Scoreboard";
import { TeamDot } from "@/components/TeamDot";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import { api, ApiError, catalogLabel, type Game, errorText } from "@/lib/client/api";
import { useLiveGame } from "@/lib/client/live";
import { formatList, plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import type { Locale } from "@/i18n/locales";
import { BuzzerPad } from "./BuzzerPad";
import styles from "./play.module.css";

/** Lo que el servidor deja ver a quien juega desde el móvil: la partida sin sus ajustes internos. */
type PlayGame = Omit<Game, "filters" | "nextTrackReady">;
interface PlayState {
  game: PlayGame;
  me: { id: string; name: string; playerId: string; memberId: string | null; lockedOut: boolean };
}

/** Cómo acabó la partida, dicho para quien la jugó. */
function finaleLine(players: PlayGame["players"], myPlayerId: string, teams: boolean, t: Messages["play"], locale: Locale) {
  const top = players[0];
  if (!top || top.score === 0) return t.nobodyScored;
  const tied = players.filter((p) => p.score === top.score);
  if (tied.length > 1) return t.tie(formatList(locale, tied.map((p) => p.name)));
  return top.id === myPlayerId ? (teams ? t.yourTeamWon : t.youWon) : t.winnerWas(top.name);
}

/** El mando de quien se unió con el código: dónde va la partida y quién es él. */
export function PlayClient() {
  const { gameId } = useParams<{ gameId: string }>();
  const { m, locale } = useI18n();
  const t = m.play;
  const [state, setState] = useState<PlayState | null>(null);
  /** Cuándo se leyó el estado: el tiempo que le queda a quien responde se mide desde ahí. */
  const [fetchedAt, setFetchedAt] = useState(0);
  const [error, setError] = useState<{ missing: boolean; message: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await api<PlayState>(`/api/play/${gameId}`));
      setFetchedAt(Date.now());
      setError(null);
    } catch (e) {
      const missing = e instanceof ApiError && e.status === 404;
      setError({ missing, message: errorText(e) });
    }
  }, [gameId]);

  useEffect(() => {
    // Carga inicial desde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Cualquier aviso de la partida (alguien pulsa, suena otra pista, termina) vuelve a leer el estado.
  const live = useLiveGame(gameId, () => void refresh(), !error?.missing);

  if (error?.missing) {
    return (
      <>
        <BandStatus text={t.outBand} />
        <main className={styles.main}>
          <section className={`${ui.card} ${styles.card}`}>
            <div className={ui.cardStripes} />
            <div className={styles.body}>
              <h1 className={styles.headline}>{t.outTitle}</h1>
              <p className={styles.lede}>{t.outLede}</p>
              <Link href="/unirse" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
                {t.joinWithCode}
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (!state) {
    return (
      <>
        <BandStatus text={t.connecting} />
        <main className={styles.main}>
          {error ? <RetryNotice message={error.message} onRetry={refresh} /> : <p className={styles.loading}>{m.common.loading}</p>}
        </main>
      </>
    );
  }

  const { game, me } = state;
  const cat = catalogLabel(game.catalogNumber);
  const mine = game.players.find((p) => p.id === me.playerId);
  const round = game.round;
  const winner = round?.winnerPlayerId ? (game.players.find((p) => p.id === round.winnerPlayerId) ?? null) : null;
  const finished = game.status === "FINISHED" && round?.status !== "PLAYING";
  const status = round
    ? `${cat} · ${t.trackOf(round.number, game.totalRounds)}`
    : `${cat} · ${plural(locale, game.totalRounds, t.tracks)}`;

  return (
    <>
      <BandStatus text={finished ? `${cat} · ${t.endOfTape}` : status} />
      <main className={styles.main}>
        {live === "offline" && (
          <p className={`${ui.notice} ${ui.noticeError}`} role="status">
            <WifiOff size={20} aria-hidden />
            {t.unstable}
          </p>
        )}
        <section className={`${ui.card} ${styles.card}`} aria-live="polite">
          <div className={ui.cardStripes} />
          <div className={styles.body}>
            <div className={styles.who}>
              <p className={styles.whoName}>
                <TeamDot color={mine?.color} size={16} />
                {me.name}
              </p>
              {game.format === "teams" && mine && <p className={styles.whoTeam}>{mine.name}</p>}
            </div>

            {finished ? (
              <>
                <h1 className={styles.headline}>{t.endOfTape}</h1>
                <p className={styles.lede}>{finaleLine(game.players, me.playerId, game.format === "teams", t, locale)}</p>
                <Podium
                  entries={game.players.map((p) => ({
                    ...p,
                    place: game.players.findIndex((q) => q.score === p.score) + 1,
                  }))}
                  size="grand"
                  tone="card"
                />
                <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
                  {t.backHome}
                </Link>
              </>
            ) : !round ? (
              <>
                <h1 className={styles.headline}>{t.waitingTitle}</h1>
                <p className={styles.lede}>{t.waitingLede}</p>
              </>
            ) : round.status === "PLAYING" ? (
              <>
                <h1 className={styles.headline}>{round.buzz?.participantId === me.id ? t.yourTurn : t.track(round.number)}</h1>
                <BuzzerPad gameId={gameId} round={round} me={me} fetchedAt={fetchedAt} onChanged={refresh} />
              </>
            ) : (
              <>
                <h1 className={styles.headline}>
                  {!winner
                    ? t.nobodyGotIt
                    : winner.id === me.playerId
                      ? game.format === "teams"
                        ? t.yourTeamGotIt
                        : t.youGotIt
                      : t.trackGuessed}
                </h1>
                {round.answer && (
                  <div className={styles.answer}>
                    {round.answer.albumImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.cover} src={round.answer.albumImage} alt="" />
                    )}
                    <p className={styles.song}>{round.answer.name}</p>
                    <p className={styles.artist}>{round.answer.artists.join(", ")}</p>
                  </div>
                )}
                <p className={styles.lede}>
                  {winner && winner.id !== me.playerId ? t.guessedBy(winner.name) : ""}
                  {t.waitingNext}
                </p>
              </>
            )}
          </div>
        </section>

        <Scoreboard players={game.players} title={t.scoreboard(cat)} />
      </main>
    </>
  );
}
