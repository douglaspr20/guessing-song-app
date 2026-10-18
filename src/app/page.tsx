"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Plus, Play } from "lucide-react";
import { Cassette } from "@/components/Cassette";
import { Podium } from "@/components/Podium";
import { TopBar } from "@/components/TopBar";
import ui from "@/components/ui.module.css";
import { api, catalogLabel, formatDate, type AuthStatus, type GameList } from "@/lib/client/api";
import styles from "./home.module.css";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Cancelaste el permiso en Spotify. Vuelve a intentarlo y pulsa «Aceptar».",
  state: "Spotify no pudo confirmar el inicio de sesión. Abre el juego en http://127.0.0.1:3000 y vuelve a conectar.",
  failed: "Spotify no respondió bien al conectar. Prueba otra vez en un momento.",
};

/** Quien eligió «Jugar sin cuenta» lo recuerda este navegador, para no preguntarle cada vez. */
const GUEST_KEY = "adivina:sin-cuenta";

function readGuestChoice(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

function saveGuestChoice(guest: boolean) {
  try {
    if (guest) localStorage.setItem(GUEST_KEY, "1");
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // Sin almacenamiento (modo privado): la elección dura lo que la pestaña.
  }
}

export default function Home() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [guest, setGuest] = useState(false);
  const [list, setList] = useState<GameList | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    // Lee el error del login y la elección «sin cuenta» una vez al montar (vienen del navegador).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (code) setLoginError(LOGIN_ERRORS[code] ?? LOGIN_ERRORS.failed);
    setGuest(readGuestChoice());
    api<AuthStatus>("/api/auth/status").then(setAuth, () => setAuth({ connected: false }));
  }, []);

  // La estantería solo aparece tras conectar Spotify o elegir jugar sin cuenta.
  const view = !auth ? "loading" : auth.connected ? "spotify" : guest ? "guest" : "connect";
  const showsShelf = view === "spotify" || view === "guest";
  useEffect(() => {
    if (showsShelf) api<GameList>("/api/games?limit=12").then(setList, () => setList({ total: 0, games: [] }));
  }, [showsShelf]);

  const chooseGuest = () => {
    saveGuestChoice(true);
    setGuest(true);
  };
  const leaveGuest = () => {
    saveGuestChoice(false);
    setGuest(false);
  };
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setAuth({ connected: false });
  };

  const status =
    view === "spotify" ? `Música de ${auth?.profile?.displayName ?? "tu cuenta"}` : view === "guest" ? "Sin cuenta · 30 s" : undefined;

  return (
    <div className={styles.page}>
      <TopBar status={status} />
      <main className={styles.main}>
        {view === "loading" && <p className={styles.loading}>Rebobinando…</p>}
        {view === "connect" && <Connect error={loginError} onGuest={chooseGuest} />}
        {view === "spotify" && (
          <Shelf
            list={list}
            premium={auth?.profile?.premium ?? null}
            newGameHref="/nueva"
            footer={
              <button type="button" className={styles.linkBtn} onClick={logout}>
                Desconectar Spotify
              </button>
            }
          />
        )}
        {view === "guest" && (
          <Shelf
            // Sin cuenta solo se pueden jugar (y retomar) las partidas abiertas.
            list={list && onlyOpenGames(list)}
            premium={null}
            newGameHref="/nueva?modo=abierto"
            footer={
              <>
                <a href="/api/auth/login" className={styles.linkBtn}>
                  Conectar con Spotify
                </a>
                <button type="button" className={styles.linkBtn} onClick={leaveGuest}>
                  Volver al inicio
                </button>
              </>
            }
          />
        )}
      </main>
    </div>
  );
}

/** Las partidas que se pueden jugar sin cuenta. */
function onlyOpenGames(list: GameList): GameList {
  const games = list.games.filter((g) => g.mode === "open");
  return { total: games.length, games };
}

function Connect({ error, onGuest }: { error: string | null; onGuest: () => void }) {
  return (
    <section className={styles.connect}>
      <div>
        <h1 className={styles.headline}>
          Suena la cinta.
          <br />
          <em>¿Quién la canta?</em>
        </h1>
        <p className={styles.lede}>
          Conecta el Spotify de quien pone la música y <strong>graba una partida</strong> con las canciones de la
          familia.
        </p>
        <div className={styles.actions}>
          <a href="/api/auth/login" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
            Conectar con Spotify
          </a>
          <button type="button" className={`${ui.btn} ${ui.onShell} ${ui.big}`} onClick={onGuest}>
            Jugar sin cuenta
          </button>
        </div>
        <p className={styles.req}>
          <Info size={20} aria-hidden />
          Con Spotify suena la canción entera (Premium, en Chrome o Edge). Sin cuenta suenan vistas previas de 30 s, en
          cualquier navegador.
        </p>
        {error && (
          <p className={`${ui.notice} ${ui.noticeError} ${styles.error}`} role="alert">
            <AlertTriangle size={20} aria-hidden />
            {error}
          </p>
        )}
      </div>
      <Cassette
        title="Lado A · Pista 1"
        value={
          <>
            Vale <b>3 pts</b>
          </>
        }
        remainingMs={60_000}
        progress={0}
        running={false}
        caption="listo para grabar"
        hints={[
          { key: "words", label: "Palabras", at: "20 s", value: null, unlocked: false },
          { key: "artist", label: "Artista", at: "40 s", value: null, unlocked: false },
          { key: "letters", label: "Letras", at: "60 s", value: null, unlocked: false },
        ]}
      />
    </section>
  );
}

function Shelf({
  list,
  premium,
  newGameHref,
  footer,
}: {
  list: GameList | null;
  premium: boolean | null;
  /** A qué formulario lleva «Grabar partida nueva» (sin cuenta, directo al modo abierto). */
  newGameHref: string;
  footer: ReactNode;
}) {
  const count = list?.total ?? 0;
  return (
    <>
      <div className={styles.shelfHead}>
        <div>
          <h1 className={styles.shelfTitle}>Tu estantería</h1>
          <p className={styles.shelfSub}>
            {list
              ? count
                ? `${count} ${count === 1 ? "casete grabado" : "casetes grabados"}`
                : "Todavía no hay casetes"
              : "Buscando casetes…"}
          </p>
        </div>
        <Link href={newGameHref} className={`${ui.btn} ${ui.primary} ${ui.big}`}>
          <Plus size={28} strokeWidth={3} aria-hidden />
          Grabar partida nueva
        </Link>
      </div>

      {premium === false && (
        <p className={`${ui.notice} ${ui.noticeError}`} role="alert" style={{ marginBottom: 24 }}>
          <AlertTriangle size={20} aria-hidden />
          Esta cuenta de Spotify no es Premium: las canciones no podrán sonar.
        </p>
      )}

      {list && list.games.length === 0 && (
        <div className={styles.emptyShelf}>
          <div className={styles.spineBand} />
          <p className={styles.emptyText}>
            <strong>La estantería está vacía.</strong>
            Graba la primera partida y aquí quedará con su podio.
          </p>
        </div>
      )}

      {list && list.games.length > 0 && (
        <ul className={styles.shelf}>
          {list.games.map((g) => {
            const winner = g.podium[0];
            const finished = g.status === "FINISHED";
            const tied = g.podium.filter((p) => p.place === 1);
            return (
              <li key={g.id} className={styles.spine}>
                {/* Lomo del casete: rayas de borde a borde con el número de catálogo pegado. */}
                <div className={styles.spineBand}>
                  <span className={styles.catalog}>{catalogLabel(g.catalogNumber)}</span>
                  <span className={styles.spineMeta}>
                    {g.mode === "open" ? "Sin cuenta · 30 s · " : ""}
                    {formatDate(g.createdAt)}
                  </span>
                </div>
                <div className={styles.spineBody}>
                  <div className={styles.spineInfo}>
                    <span className={styles.meta}>
                      {g.playedRounds}/{g.totalRounds} pistas · {g.playerCount} {g.playerCount === 1 ? "jugador" : "jugadores"}
                    </span>
                    {finished ? (
                      <span className={styles.winner}>
                        {winner && winner.score > 0
                          ? tied.length > 1
                            ? `Empate: ${tied.map((p) => p.name).join(" y ")}`
                            : `Ganó ${winner.name}`
                          : "Nadie sumó puntos"}
                      </span>
                    ) : (
                      <>
                        <span className={styles.badge}>A medio grabar</span>
                        <Link href={`/partida/${g.id}`} className={`${ui.btn} ${ui.onCard} ${styles.resume}`}>
                          <Play size={20} aria-hidden />
                          Seguir jugando
                        </Link>
                      </>
                    )}
                  </div>
                  <div className={styles.spinePodium}>
                    <Podium entries={g.podium} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.foot}>{footer}</div>
    </>
  );
}
