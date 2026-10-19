"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Plus, Play } from "lucide-react";
import { AccountCard, type AccountTab } from "@/components/AccountCard";
import { Cassette } from "@/components/Cassette";
import { Podium } from "@/components/Podium";
import { TopBar } from "@/components/TopBar";
import ui from "@/components/ui.module.css";
import { api, ApiError, catalogLabel, formatDate, type AccessStatus, type GameList } from "@/lib/client/api";
import styles from "./home.module.css";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Cancelaste el permiso en Spotify. Vuelve a intentarlo y pulsa «Aceptar».",
  state: "Spotify no pudo confirmar el inicio de sesión. Vuelve a conectar desde la dirección principal del juego.",
  failed: "Spotify no respondió bien al conectar. Prueba otra vez en un momento.",
  session: "Tu sesión caducó mientras conectabas Spotify. Entra de nuevo y vuelve a probar.",
  not_allowed:
    "Esta cuenta de Spotify no está autorizada en la app. Pide al anfitrión que te añada en el panel de Spotify.",
  in_use: "Esa cuenta de Spotify ya está vinculada a otro usuario de la app.",
};

const SIGNED_OUT: AccessStatus = { user: null, guest: false, spotify: null, openModePaused: false };
const PAUSED_NOTICE = "El modo sin cuenta está en mantenimiento. Vuelve a probar en un rato.";

export default function Home() {
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [list, setList] = useState<GameList | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setList(null);
    setAccess(await api<AccessStatus>("/api/access/status").catch(() => SIGNED_OUT));
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    // Lee el error del login de Spotify una vez al montar (viene en la URL).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (code) setLoginError(LOGIN_ERRORS[code] ?? LOGIN_ERRORS.failed);
    refresh();
  }, [refresh]);

  // La estantería solo aparece con sesión o tras elegir jugar sin cuenta.
  const view = !access ? "loading" : access.user ? "account" : access.guest ? "guest" : "connect";
  const showsShelf = view === "account" || view === "guest";
  useEffect(() => {
    if (showsShelf) api<GameList>("/api/games?limit=12").then(setList, () => setList({ total: 0, games: [] }));
  }, [showsShelf, access]);

  const playAsGuest = async () => {
    setNotice(null);
    try {
      await api("/api/guest", { method: "POST" });
      await refresh();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "No se pudo empezar. Prueba otra vez.");
    }
  };
  const leaveGuest = async () => {
    await api("/api/guest", { method: "DELETE" }).catch(() => undefined);
    await refresh();
  };
  const signOut = async () => {
    await api("/api/account/logout", { method: "POST" }).catch(() => undefined);
    await refresh();
  };
  const unlinkSpotify = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    await refresh();
  };

  const status =
    view === "account" && access?.user
      ? access.spotify
        ? `${access.user.displayName} · Spotify`
        : access.user.displayName
      : view === "guest"
        ? "Sin cuenta · 30 s"
        : undefined;

  return (
    <div className={styles.page}>
      <TopBar status={status} />
      <main className={styles.main}>
        {view === "loading" && <p className={styles.loading}>Rebobinando…</p>}
        {view === "connect" && (
          <Connect error={loginError ?? notice} paused={!!access?.openModePaused} onGuest={playAsGuest} onSignedIn={refresh} />
        )}
        {view === "account" && (
          <Shelf
            list={list}
            premium={access?.spotify?.premium ?? null}
            newGameHref={access?.spotify ? "/nueva" : "/nueva?modo=abierto"}
            notice={loginError}
            footer={
              <>
                {access?.user?.role === "host" && (
                  <Link href="/anfitrion" className={styles.linkBtn}>
                    Panel del anfitrión
                  </Link>
                )}
                {access?.spotify ? (
                  <button type="button" className={styles.linkBtn} onClick={unlinkSpotify}>
                    Desvincular Spotify
                  </button>
                ) : (
                  <a href="/api/auth/login" className={styles.linkBtn}>
                    Conectar mi Spotify
                  </a>
                )}
                <button type="button" className={styles.linkBtn} onClick={signOut}>
                  Salir
                </button>
              </>
            }
          />
        )}
        {view === "guest" && (
          <Shelf
            list={list}
            premium={null}
            newGameHref="/nueva?modo=abierto"
            notice={access?.openModePaused ? PAUSED_NOTICE : null}
            footer={
              <button type="button" className={styles.linkBtn} onClick={leaveGuest}>
                Volver al inicio
              </button>
            }
          />
        )}
      </main>
    </div>
  );
}

function Connect({
  error,
  paused,
  onGuest,
  onSignedIn,
}: {
  error: string | null;
  paused: boolean;
  onGuest: () => void;
  onSignedIn: () => void;
}) {
  // Al pulsar «Entrar» o «Tengo una invitación», la carátula del formulario ocupa el sitio del casete.
  const [account, setAccount] = useState<AccountTab | null>(null);
  return (
    <section className={styles.connect}>
      <div>
        <h1 className={styles.headline}>
          Suena la cinta.
          <br />
          <em>¿Quién la canta?</em>
        </h1>
        <p className={styles.lede}>
          Graba una partida, pon la música y que la familia adivine <strong>título y artista</strong> antes que nadie.
        </p>
        <div className={styles.actions}>
          <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={onGuest} disabled={paused}>
            Jugar sin cuenta
          </button>
          <button type="button" className={`${ui.btn} ${ui.onShell} ${ui.big}`} onClick={() => setAccount("login")}>
            Entrar
          </button>
        </div>
        <p className={styles.req}>
          <Info size={20} aria-hidden />
          <span>
            {paused ? PAUSED_NOTICE : "Sin cuenta suenan vistas previas de 30 s, en cualquier navegador."}{" "}
            <button type="button" className={styles.inlineLink} onClick={() => setAccount("invite")}>
              ¿Tienes una invitación?
            </button>
          </span>
        </p>
        {error && (
          <p className={`${ui.notice} ${ui.noticeError} ${styles.error}`} role="alert">
            <AlertTriangle size={20} aria-hidden />
            {error}
          </p>
        )}
      </div>
      {account ? (
        <AccountCard key={account} initialTab={account} onDone={onSignedIn} onCancel={() => setAccount(null)} />
      ) : (
        <Cassette
          title="Lado A · Pista 1"
          value={
            <>
              Vale <b>3 pts</b>
            </>
          }
          remainingMs={30_000}
          progress={0}
          running={false}
          caption="listo para grabar"
          hints={[
            { key: "words", label: "Palabras", at: "10 s", value: null, unlocked: false },
            { key: "artist", label: "Artista", at: "20 s", value: null, unlocked: false },
            { key: "letters", label: "Letras", at: "25 s", value: null, unlocked: false },
          ]}
        />
      )}
    </section>
  );
}

function Shelf({
  list,
  premium,
  newGameHref,
  notice,
  footer,
}: {
  list: GameList | null;
  premium: boolean | null;
  /** A qué formulario lleva «Grabar partida nueva» (sin Spotify, directo al modo abierto). */
  newGameHref: string;
  /** Aviso arriba de la estantería (error al conectar Spotify, mantenimiento…). */
  notice?: string | null;
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

      {notice && (
        <p className={`${ui.notice} ${ui.noticeError}`} role="alert" style={{ marginBottom: 24 }}>
          <AlertTriangle size={20} aria-hidden />
          {notice}
        </p>
      )}

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
