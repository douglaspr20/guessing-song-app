"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Check, Eye, Pause, Play, RotateCcw, Settings2, SkipForward, Trophy, X } from "lucide-react";
import { Cassette, type HintMark } from "@/components/Cassette";
import { Podium } from "@/components/Podium";
import { Scoreboard } from "@/components/Scoreboard";
import { TapeConfetti } from "@/components/TapeConfetti";
import { TopBar } from "@/components/TopBar";
import ui from "@/components/ui.module.css";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { pointsForElapsed, HINT_INTERVAL_MS } from "@/lib/game/scoring";
import { api, ApiError, catalogLabel, formatDate, type Game, type GuessResult, type GuessRow, type Round } from "@/lib/client/api";
import styles from "./game.module.css";

const INTERMISSION_MS = 3000;
const ARTIST_DEADLINE_MS = 2 * HINT_INTERVAL_MS;

const HINTS: { key: string; label: string; at: string }[] = [
  { key: "words", label: "Palabras", at: "20 s" },
  { key: "artist", label: "Artista", at: "40 s" },
  { key: "letters", label: "Letras", at: "60 s" },
];

interface Feedback {
  tone: "good" | "bad";
  text: string;
}

export function GameClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const player = useSpotifyPlayer();

  const [game, setGame] = useState<Game | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intermission, setIntermission] = useState<{ number: number; endsAt: number } | null>(null);
  const [showFinale, setShowFinale] = useState(false);
  const [gains, setGains] = useState<Record<string, number>>({});

  const [who, setWho] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const g = await api<Game>(`/api/games/${id}`);
    setGame(g);
    setFetchedAt(Date.now());
    if (g.round) {
      const r = await api<{ guesses: GuessRow[] }>(`/api/games/${id}/rounds/${g.round.id}/guesses`);
      setGuesses(r.guesses);
    } else {
      setGuesses([]);
    }
    return g;
  }, [id]);

  useEffect(() => {
    // Carga inicial de la partida desde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().then(
      (g) => {
        if (g.status === "FINISHED" && g.round?.status !== "PLAYING") setShowFinale(true);
      },
      (e) => setLoadError(e instanceof ApiError && e.status === 404 ? "Esta partida no existe." : (e as Error).message),
    );
  }, [refresh]);

  // Reloj de pantalla (puntos en juego, pistas, entreacto).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // La siguiente pista la desbloquea el servidor: se le pregunta justo cuando toca.
  const nextHintAt = game?.round?.nextHintAt;
  useEffect(() => {
    if (!nextHintAt) return;
    const wait = Math.max(0, new Date(nextHintAt).getTime() - Date.now()) + 200;
    const t = setTimeout(() => void refresh().catch(() => {}), wait);
    return () => clearTimeout(t);
  }, [nextHintAt, refresh]);

  // Fin del entreacto: suena la pista.
  useEffect(() => {
    if (!intermission || !game?.round) return;
    const t = setTimeout(async () => {
      setIntermission(null);
      try {
        await player.playFragment(id, game.round!.id);
        await refresh();
        titleRef.current?.focus();
      } catch (e) {
        setActionError((e as Error).message);
      }
    }, Math.max(0, intermission.endsAt - Date.now()));
    return () => clearTimeout(t);
    // Solo depende del entreacto programado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intermission]);

  const round = game?.round ?? null;
  const open = round?.status === "PLAYING";

  // Tiempo de ronda en pantalla: lo que dijo el servidor + lo que ha pasado desde entonces (si no está en pausa).
  const elapsed =
    round?.playStartedAt && open
      ? round.elapsedMs + (round.paused || !now ? 0 : Math.max(0, now - fetchedAt))
      : (round?.elapsedMs ?? 0);
  const pointsNow = pointsForElapsed(elapsed);
  const nextDropIn = pointsNow > 1 ? HINT_INTERVAL_MS - (elapsed % HINT_INTERVAL_MS) : null;
  const artistOpen = !!round?.artistAvailable && elapsed < ARTIST_DEADLINE_MS;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startNext = () =>
    run(async () => {
      if (!game) return;
      await player.activate(); // dentro del clic: el audio podrá sonar tras el entreacto
      await player.stop();
      setFeedback(null);
      setTitle("");
      setArtist("");
      const r = await api<Round>(`/api/games/${id}/rounds`, { method: "POST" });
      await refresh();
      setIntermission({ number: r.number, endsAt: Date.now() + INTERMISSION_MS });
    });

  const replay = () =>
    run(async () => {
      if (!round) return;
      await player.activate();
      await player.playFragment(id, round.id);
      await refresh();
    });

  const togglePause = () =>
    run(async () => {
      if (!round) return;
      if (player.phase === "paused") {
        await player.resume();
        await api(`/api/games/${id}/rounds/${round.id}/resume`, { method: "POST" });
      } else {
        await player.pause();
        await api(`/api/games/${id}/rounds/${round.id}/pause`, { method: "POST" });
      }
      await refresh();
    });

  const reveal = () =>
    run(async () => {
      if (!round) return;
      await player.stop();
      await api(`/api/games/${id}/rounds/${round.id}/reveal`, { method: "POST" });
      await refresh();
    });

  const flashGain = (playerId: string, points: number) => {
    setGains({ [playerId]: points });
    setTimeout(() => setGains({}), 2400);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!round || !game) return;
      const name = game.players.find((p) => p.id === who)?.name ?? "";
      const r = await api<GuessResult>(`/api/games/${id}/rounds/${round.id}/guesses`, {
        json: { playerId: who, title: title.trim() || undefined, artist: artist.trim() || undefined },
      });
      setFeedback(describe(name, r, !!title.trim(), !!artist.trim()));
      if (r.points) flashGain(who, r.points);
      setTitle("");
      setArtist("");
      if (r.titleAwarded) await player.stop();
      await refresh();
      titleRef.current?.focus();
    });
  };

  const accept = (g: GuessRow, part: "title" | "artist") =>
    run(async () => {
      if (!round) return;
      const r = await api<{ points: number; titleAwarded: boolean }>(
        `/api/games/${id}/rounds/${round.id}/guesses/${g.id}/accept`,
        { json: { [part]: true } },
      );
      setFeedback({ tone: "good", text: `Dado por bueno: ${g.playerName} suma ${r.points}` });
      flashGain(g.playerId, r.points);
      if (r.titleAwarded) await player.stop();
      await refresh();
    });

  // Atajo para el anfitrión: teclas 1-9 eligen jugador (fuera de los campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!game || !open) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "text") return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && game.players[n - 1]) setWho(game.players[n - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, open]);

  // Elige por defecto al primer jugador del marcador.
  const whoValid = !!game?.players.some((p) => p.id === who);
  const whoId = whoValid ? who : (game?.players[0]?.id ?? "");

  if (loadError) {
    return (
      <>
        <TopBar />
        <main className={styles.main}>
          <div className={styles.stage}>
            <div className={styles.stageInner}>
              <p className={styles.stageTitle}>{loadError}</p>
              <Link href="/" className={`${ui.btn} ${ui.onShell}`}>
                Volver a la estantería
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!game) {
    return (
      <>
        <TopBar />
        <main className={styles.main}>
          <div className={styles.stage}>
            <p className={styles.stageLabel}>Rebobinando…</p>
          </div>
        </main>
      </>
    );
  }

  const cat = catalogLabel(game.catalogNumber);
  const status = round ? `${cat} · Pista ${round.number} de ${game.totalRounds}` : `${cat} · ${game.totalRounds} pistas`;
  const isLast = game.currentRound >= game.totalRounds;

  // ---------- Final ----------
  if (showFinale) return <Finale game={game} />;

  // ---------- Entreacto ----------
  if (intermission) {
    const left = now ? Math.min(3, Math.max(1, Math.ceil((intermission.endsAt - now) / 1000))) : 3;
    return (
      <>
        <TopBar status={status} />
        <main className={styles.main}>
          <div className={styles.stage} aria-live="assertive">
            <div className={styles.stageInner}>
              <p className={styles.stageLabel}>
                Pista {intermission.number} de {game.totalRounds}
              </p>
              <p key={left} className={`${styles.countdown} ${styles.tick}`}>
                {left}
              </p>
              <p className={styles.stageNote}>Silencio en la sala… la cinta está a punto de sonar.</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const hints: HintMark[] = HINTS.map((h) => {
    const got = round?.hints.find((x) => x.type === h.key);
    return { ...h, value: got?.value ?? null, unlocked: !!got };
  });

  const playing = player.phase === "playing";
  const tapeProgress = player.fragmentMs ? 1 - player.remainingMs / player.fragmentMs : open && round?.playStartedAt ? 1 : 0;
  const caption = !round?.playStartedAt
    ? "aún no ha sonado"
    : player.phase === "paused"
      ? "en pausa"
      : player.phase === "ended" || player.phase === "idle"
        ? "se acabó la cinta"
        : "quedan para adivinar";

  const playerProblem = player.status === "error" ? player.error : null;

  return (
    <>
      <TopBar status={status} />
      <main className={styles.main}>
        {playerProblem && (
          <p className={`${ui.notice} ${ui.noticeError} ${styles.playerError}`} role="alert">
            <AlertTriangle size={20} aria-hidden />
            {playerProblem}
          </p>
        )}

        <div className={styles.layout}>
          <div className={styles.deck}>
            {/* ---------- Antes de la primera pista ---------- */}
            {!round && (
              <div className={styles.revealCard} style={{ gridTemplateColumns: "1fr" }}>
                <div>
                  <p className={styles.revealTitle}>
                    <span className={styles.revealEra}>Listo:</span>{" "}
                    {game.players.length} {game.players.length === 1 ? "jugador" : "jugadores"}, {game.totalRounds}{" "}
                    {game.totalRounds === 1 ? "pista" : "pistas"}
                  </p>
                  <p className={styles.revealResult}>
                    Cada canción suena {game.fragmentSeconds} s. El título vale 3, 2 o 1 punto según lo rápido que se
                    acierte; el artista suma 1 más si se dice antes de los 40 s.
                  </p>
                </div>
              </div>
            )}

            {/* ---------- Ronda abierta: el casete ---------- */}
            {round && open && (
              <>
                <Cassette
                  title={`Pista ${round.number} — ¿Qué canción es?`}
                  value={
                    round.playStartedAt ? (
                      <>
                        Título <b>{pointsNow} pts</b>
                        {nextDropIn !== null && !round.paused ? ` · baja en ${Math.ceil(nextDropIn / 1000)} s` : ""}
                        {artistOpen ? " · artista +1" : ""}
                      </>
                    ) : (
                      "Pulsa reproducir"
                    )
                  }
                  remainingMs={round.playStartedAt ? player.remainingMs : game.fragmentSeconds * 1000}
                  progress={tapeProgress}
                  running={playing}
                  caption={caption}
                  hints={hints}
                />
                <form className={`${ui.card} ${styles.answer}`} onSubmit={submit}>
                  <fieldset className={styles.who}>
                    <legend className={styles.fieldLabel}>¿Quién lo dijo?</legend>
                    {game.players.map((p, i) => (
                      <label key={p.id} className={styles.whoOption}>
                        <input type="radio" name="who" value={p.id} checked={whoId === p.id} onChange={() => setWho(p.id)} />
                        <span>
                          {p.name}
                          {i < 9 && <kbd>{i + 1}</kbd>}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div className={styles.fields}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        Canción · <b>{round.playStartedAt ? pointsNow : 3} pts</b>
                      </span>
                      <input
                        ref={titleRef}
                        type="text"
                        className={styles.handInput}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Lo que dijo…"
                        autoComplete="off"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        Artista · {artistOpen ? <b>+1</b> : "ya no suma"}
                      </span>
                      <input
                        type="text"
                        className={styles.handInput}
                        value={artist}
                        onChange={(e) => setArtist(e.target.value)}
                        placeholder="Quién la canta…"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  {feedback && (
                    <p
                      className={`${styles.feedback} ${feedback.tone === "good" ? styles.feedbackGood : styles.feedbackBad}`}
                      role="status"
                    >
                      {feedback.text}
                    </p>
                  )}
                  {!round.playStartedAt && <p className={styles.fieldLabel}>Se puede responder cuando empiece a sonar.</p>}
                  <div className={styles.submitRow}>
                    <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={replay} disabled={busy || player.status !== "ready"}>
                      {round.playStartedAt ? <RotateCcw size={22} aria-hidden /> : <Play size={22} aria-hidden />}
                      {round.playStartedAt ? "Repetir" : "Reproducir"}
                    </button>
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.onCard}`}
                      onClick={togglePause}
                      disabled={busy || (player.phase !== "playing" && player.phase !== "paused")}
                    >
                      {player.phase === "paused" ? <Play size={22} aria-hidden /> : <Pause size={22} aria-hidden />}
                      {player.phase === "paused" ? "Seguir" : "Pausar"}
                    </button>
                    <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={reveal} disabled={busy}>
                      <Eye size={22} aria-hidden />
                      Revelar
                    </button>
                    <button
                      type="submit"
                      className={`${ui.btn} ${ui.primary} ${styles.register}`}
                      disabled={busy || !round.playStartedAt || (!title.trim() && !artist.trim())}
                    >
                      Registrar respuesta
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ---------- Ronda cerrada: la revelación ---------- */}
            {round && !open && round.answer && (
              <>
                <div className={styles.revealCard}>
                  {round.answer.albumImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.cover} src={round.answer.albumImage} alt="" />
                  ) : (
                    <div className={styles.cover} />
                  )}
                  <div>
                    <p className={styles.revealTitle}>
                      <span className={styles.revealEra}>Era</span> {round.answer.name}
                    </p>
                    <p className={styles.revealArtist}>{round.answer.artists.join(", ")}</p>
                    <p className={styles.revealResult}>{revealLine(game, round)}</p>
                  </div>
                </div>
                {feedback && (
                  <p
                    className={`${styles.feedback} ${feedback.tone === "good" ? styles.feedbackGood : styles.feedbackBad}`}
                    role="status"
                  >
                    {feedback.text}
                  </p>
                )}
              </>
            )}

            {actionError && (
              <p className={`${ui.notice} ${ui.noticeError}`} role="alert">
                <AlertTriangle size={20} aria-hidden />
                {actionError}
              </p>
            )}

            {/* ---------- Avanzar ---------- */}
            {(!round || !open) && (
              <div className={styles.nextRow}>
                {game.status === "FINISHED" || isLast ? (
                  <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={() => setShowFinale(true)}>
                    <Trophy size={28} aria-hidden />
                    Ver el podio
                  </button>
                ) : (
                  <>
                  {!round && (
                    // Antes de la primera pista todavía se pueden cambiar jugadores, rondas y filtros.
                    <Link href={`/nueva?editar=${game.id}`} className={`${ui.btn} ${ui.onShell} ${ui.big}`}>
                      <Settings2 size={26} aria-hidden />
                      Editar ajustes
                    </Link>
                  )}
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.primary} ${ui.big}`}
                    onClick={startNext}
                    disabled={busy || player.status !== "ready"}
                  >
                    <SkipForward size={28} aria-hidden />
                    {round ? "Siguiente pista" : "Empezar"}
                  </button>
                  </>
                )}
              </div>
            )}

            {round && guesses.length > 0 && (
              <details className={`${ui.card} ${styles.attempts}`} open={!open}>
                <summary>Intentos de esta pista · {guesses.length}</summary>
                <ol className={styles.attemptList}>
                  {guesses.map((g) => (
                    <li key={g.id} className={styles.attempt}>
                      <span className={styles.attemptAt}>{Math.floor(g.atMs / 1000)} s</span>
                      <div className={styles.attemptBody}>
                        <span className={styles.attemptWho}>{g.playerName}</span>
                        {g.title && (
                          <span className={styles.attemptPart}>
                            {g.titleCorrect ? <Check className={styles.ok} size={20} aria-label="bien" /> : <X className={styles.no} size={20} aria-label="mal" />}
                            «{g.title}»
                            {!g.titleCorrect && !round.winnerPlayerId && (
                              <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.accept}`} onClick={() => accept(g, "title")} disabled={busy}>
                                Dar por bueno
                              </button>
                            )}
                          </span>
                        )}
                        {g.artist && (
                          <span className={styles.attemptPart}>
                            {g.artistCorrect ? <Check className={styles.ok} size={20} aria-label="bien" /> : <X className={styles.no} size={20} aria-label="mal" />}
                            artista «{g.artist}»
                            {!g.artistCorrect && !round.artistWinnerPlayerId && g.atMs < ARTIST_DEADLINE_MS && (
                              <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.accept}`} onClick={() => accept(g, "artist")} disabled={busy}>
                                Dar por bueno
                              </button>
                            )}
                          </span>
                        )}
                        {g.points > 0 && <span className={styles.attemptPts}>+{g.points}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>

          <aside className={styles.side}>
            <Scoreboard players={game.players} title={`Marcador · ${cat}`} gains={gains} />
            <button type="button" className={`${ui.btn} ${ui.onShell}`} onClick={() => router.push("/")}>
              Salir a la estantería
            </button>
          </aside>
        </div>
      </main>
    </>
  );
}

function describe(name: string, r: GuessResult, saidTitle: boolean, saidArtist: boolean): Feedback {
  const parts: string[] = [];
  if (r.titleAwarded) parts.push("¡acertó la canción");
  else if (r.titleCorrect) parts.push("acertó la canción, pero alguien fue más rápido");
  else if (saidTitle) parts.push("no es esa canción");
  if (r.artistAwarded) parts.push(parts.length ? "y el artista" : "¡acertó el artista");
  else if (r.artistCorrect) parts.push("el artista es correcto, pero ya no suma");
  else if (saidArtist) parts.push(parts.length ? "y el artista tampoco" : "no es ese artista");
  const text = `${name}: ${parts.join(" ")}${r.points ? `! +${r.points}` : ""}`;
  return { tone: r.points ? "good" : "bad", text };
}

function revealLine(game: Game, round: Round) {
  const winner = game.players.find((p) => p.id === round.winnerPlayerId);
  const artistWinner = game.players.find((p) => p.id === round.artistWinnerPlayerId);
  if (winner) {
    return (
      <>
        La adivinó <strong>{winner.name}</strong>
        {artistWinner ? (
          <>
            {" "}
            · el artista lo dijo <strong>{artistWinner.name}</strong>
          </>
        ) : null}
      </>
    );
  }
  if (artistWinner)
    return (
      <>
        Nadie dijo la canción · el artista lo dijo <strong>{artistWinner.name}</strong>
      </>
    );
  return "Nadie la adivinó esta vez.";
}

function Finale({ game }: { game: Game }) {
  const players = game.players;
  const top = players[0];
  const tied = players.filter((p) => p.score === top?.score);
  const entries = players.map((p) => ({ ...p, place: players.findIndex((q) => q.score === p.score) + 1 }));
  const nobody = !top || top.score === 0;
  const cat = catalogLabel(game.catalogNumber);

  return (
    <>
      {!nobody && <TapeConfetti />}
      <TopBar status={`${cat} · Fin de la cinta`} />
      <main className={styles.main}>
        {/* La carátula se cierra: el casete terminado, con su podio escrito. */}
        <section className={`${ui.card} ${styles.finale}`} aria-live="polite">
          <div className={styles.finaleBand}>
            <span className={styles.finaleTag}>{cat}</span>
            <span className={styles.finaleTag}>
              {game.totalRounds} {game.totalRounds === 1 ? "pista" : "pistas"} · {formatDate(game.createdAt)}
            </span>
          </div>
          <div className={styles.finaleBody}>
            <h1 className={styles.finaleTitle}>
              {nobody ? (
                "Nadie sumó puntos"
              ) : tied.length > 1 ? (
                <>
                  Empate entre <span className={styles.finaleName}>{tied.map((p) => p.name).join(" y ")}</span>
                </>
              ) : (
                <>
                  Ganó <span className={styles.finaleName}>{top.name}</span>
                </>
              )}
            </h1>
            <div className={styles.finaleGrid}>
              <div className={styles.finalePodium}>
                <Podium entries={entries} size="grand" animate tone="card" />
              </div>
              <div className={styles.finaleSide}>
                {players.length > 3 && (
                  <ol className={styles.restList} aria-label="Resto del marcador">
                    {entries.slice(3).map((p) => (
                      <li key={p.id}>
                        <span className={styles.restPos}>{p.place}</span>
                        <span className={styles.restName}>{p.name}</span>
                        <span className={styles.restPts}>{p.score}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className={styles.finaleActions}>
                  <Link href="/nueva" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
                    Grabar otra partida
                  </Link>
                  <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
                    Volver a la estantería
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
