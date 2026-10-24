"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Podium } from "@/components/Podium";
import { RetryNotice } from "@/components/RetryNotice";
import { Scoreboard } from "@/components/Scoreboard";
import { TeamDot } from "@/components/TeamDot";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import { api, ApiError, catalogLabel, type Game } from "@/lib/client/api";
import { useLiveGame } from "@/lib/client/live";
import styles from "./play.module.css";

/** Lo que el servidor deja ver a quien juega desde el móvil: la partida sin sus ajustes internos. */
type PlayGame = Omit<Game, "filters" | "nextTrackReady">;
interface PlayState {
  game: PlayGame;
  me: { id: string; name: string; playerId: string; memberId: string | null };
}

/** El mando de quien se unió con el código: dónde va la partida y quién es él. */
export function PlayClient() {
  const { gameId } = useParams<{ gameId: string }>();
  const [state, setState] = useState<PlayState | null>(null);
  const [error, setError] = useState<{ missing: boolean; message: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await api<PlayState>(`/api/play/${gameId}`));
      setError(null);
    } catch (e) {
      const missing = e instanceof ApiError && e.status === 404;
      setError({ missing, message: e instanceof ApiError ? e.message : "No se pudo conectar. Prueba otra vez." });
    }
  }, [gameId]);

  useEffect(() => {
    // Carga inicial desde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Cualquier aviso de la partida (alguien pulsa, suena otra pista, termina) vuelve a leer el estado.
  useLiveGame(gameId, () => void refresh(), !error?.missing);

  if (error?.missing) {
    return (
      <>
        <BandStatus text="Fuera de la partida" />
        <main className={styles.main}>
          <section className={`${ui.card} ${styles.card}`}>
            <div className={ui.cardStripes} />
            <div className={styles.body}>
              <h1 className={styles.headline}>Ya no estás en esta partida</h1>
              <p className={styles.lede}>Puede que haya terminado o que el anfitrión te haya sacado. Entra otra vez con el código.</p>
              <Link href="/unirse" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
                Unirme con un código
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
        <BandStatus text="Conectando" />
        <main className={styles.main}>
          {error ? <RetryNotice message={error.message} onRetry={refresh} /> : <p className={styles.loading}>Rebobinando…</p>}
        </main>
      </>
    );
  }

  const { game, me } = state;
  const cat = catalogLabel(game.catalogNumber);
  const mine = game.players.find((p) => p.id === me.playerId);
  const round = game.round;
  const finished = game.status === "FINISHED" && round?.status !== "PLAYING";
  const status = round ? `${cat} · Pista ${round.number} de ${game.totalRounds}` : `${cat} · ${game.totalRounds} pistas`;

  return (
    <>
      <BandStatus text={finished ? `${cat} · Fin de la cinta` : status} />
      <main className={styles.main}>
        <section className={`${ui.card} ${styles.card}`} aria-live="polite">
          <div className={ui.cardStripes} />
          <div className={styles.body}>
            <p className={styles.who}>
              <TeamDot color={mine?.color} size={16} />
              <strong>{me.name}</strong>
              {game.format === "teams" && mine && <span className={styles.team}>· {mine.name}</span>}
            </p>

            {finished ? (
              <>
                <h1 className={styles.headline}>Fin de la cinta</h1>
                <Podium
                  entries={game.players.map((p) => ({
                    ...p,
                    place: game.players.findIndex((q) => q.score === p.score) + 1,
                  }))}
                  size="grand"
                  tone="card"
                />
              </>
            ) : !round ? (
              <>
                <h1 className={styles.headline}>Esperando a que empiece</h1>
                <p className={styles.lede}>El anfitrión pondrá la primera pista en un momento. Mantén esta pantalla abierta.</p>
              </>
            ) : round.status === "PLAYING" ? (
              <>
                <h1 className={styles.headline}>Suena la pista {round.number}</h1>
                <p className={styles.lede}>Escucha la tele. Muy pronto podrás pulsar «¡Lo sé!» desde aquí.</p>
              </>
            ) : (
              <>
                <h1 className={styles.headline}>
                  {round.winnerPlayerId ? "Pista acertada" : "Nadie la acertó"}
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
                <p className={styles.lede}>Esperando la siguiente pista.</p>
              </>
            )}
          </div>
        </section>

        <Scoreboard players={game.players} title={`Marcador · ${cat}`} />
      </main>
    </>
  );
}
