"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BandStatus } from "@/components/band/BandStatus";
import { Card } from "@/components/Card";
import { OfflineNotice } from "@/components/Notice";
import { PlayerName } from "@/components/PlayerName";
import { RetryNotice } from "@/components/RetryNotice";
import { Scoreboard } from "@/components/Scoreboard";
import { useI18n } from "@/i18n/client";
import { api, ApiError, catalogLabel, errorText, type Game } from "@/lib/client/api";
import { useLiveGame } from "@/lib/client/live";
import { trackStatus } from "@/lib/client/status";
import { BuzzerPad } from "./BuzzerPad";
import { OutOfGame, PlayFinale, PlayReveal, PlayWaiting } from "./PlayStates";
import styles from "./play.module.css";

/** Lo que el servidor deja ver a quien juega desde el móvil: la partida sin sus ajustes internos. */
type PlayGame = Omit<Game, "filters" | "nextTrackReady">;
interface PlayState {
  game: PlayGame;
  me: { id: string; name: string; playerId: string; memberId: string | null; lockedOut: boolean };
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
  const router = useRouter();
  /** Si no se pudo pasar solo a la partida siguiente («Otra igual» del anfitrión): por qué, para reintentar a mano. */
  const [followError, setFollowError] = useState<string | null>(null);

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

  /** Pasa a la partida que el anfitrión grabó con «Otra igual»: mismo nombre y mismo sitio. */
  const follow = useCallback(async () => {
    setFollowError(null);
    try {
      const next = await api<{ gameId: string }>(`/api/play/${gameId}/follow`, { method: "POST" });
      router.replace(`/play/${next.gameId}`);
    } catch (e) {
      setFollowError(errorText(e));
    }
  }, [gameId, router]);

  // En cuanto hay partida siguiente, el móvil se pasa solo (una vez por partida, aunque el estado se relea).
  const nextGameId = state?.game.nextGameId ?? null;
  const followedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!nextGameId || followedFor.current === nextGameId) return;
    followedFor.current = nextGameId;
    void follow();
  }, [nextGameId, follow]);

  // Cualquier aviso de la partida (alguien pulsa, suena otra pista, termina) vuelve a leer el estado.
  const live = useLiveGame(gameId, () => void refresh(), !error?.missing);

  if (error?.missing) return <OutOfGame />;

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
  const teams = game.format === "teams";
  const finished = game.status === "FINISHED" && round?.status !== "PLAYING";
  const status = finished
    ? `${cat} · ${t.endOfTape}`
    : trackStatus(cat, round?.number ?? null, game.totalRounds, t, locale);

  return (
    <>
      <BandStatus text={status} />
      <main className={styles.main}>
        {live === "offline" && <OfflineNotice>{t.unstable}</OfflineNotice>}
        <Card className={styles.card} aria-live="polite">
          <div className={styles.body}>
            <div className={styles.who}>
              <PlayerName className={styles.whoName} name={me.name} color={mine?.color} />
              {teams && mine && <p className={styles.whoTeam}>{mine.name}</p>}
            </div>

            {finished ? (
              <PlayFinale
                players={game.players}
                myPlayerId={me.playerId}
                teams={teams}
                next={game.nextGameId ? { error: followError, onFollow: follow } : null}
              />
            ) : !round ? (
              <PlayWaiting />
            ) : round.status === "PLAYING" ? (
              <>
                <h1 className={styles.headline}>{round.buzz?.participantId === me.id ? t.yourTurn : t.track(round.number)}</h1>
                <BuzzerPad gameId={gameId} round={round} me={me} fetchedAt={fetchedAt} onChanged={refresh} />
              </>
            ) : (
              <PlayReveal round={round} players={game.players} myPlayerId={me.playerId} teams={teams} />
            )}
          </div>
        </Card>

        <Scoreboard players={game.players} title={t.scoreboard(cat)} />
      </main>
    </>
  );
}
