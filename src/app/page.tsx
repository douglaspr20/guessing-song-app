"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Plus, Play, Trash2 } from "lucide-react";
import { AccountCard, type AccountTab } from "@/components/AccountCard";
import { Cassette } from "@/components/Cassette";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { RedeemInvite } from "@/components/RedeemInvite";
import { RetryNotice } from "@/components/RetryNotice";
import { Podium } from "@/components/Podium";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import {
  api,
  ApiError,
  catalogLabel,
  formatDate,
  type AccessStatus,
  type GameList,
  type GameSummary,
} from "@/lib/client/api";
import styles from "./home.module.css";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Cancelaste el permiso en Spotify. Vuelve a intentarlo y pulsa «Aceptar».",
  state: "Spotify no pudo confirmar el inicio de sesión. Vuelve a conectar desde la dirección principal del juego.",
  failed: "Spotify no respondió bien al conectar. Prueba otra vez en un momento.",
  session: "Tu sesión caducó mientras conectabas Spotify. Entra de nuevo y vuelve a probar.",
  not_allowed:
    "Esta cuenta de Spotify no está autorizada en la app. Pide al anfitrión que te añada en el panel de Spotify.",
  in_use: "Esa cuenta de Spotify ya está vinculada a otro usuario de la app.",
  spotify_invite: "El modo Spotify es solo con invitación. Si el anfitrión te dio un código, canjéalo en tu estantería.",
  google_denied: "Cancelaste el acceso con Google. Vuelve a intentarlo cuando quieras.",
  google_state: "Google no pudo confirmar el inicio de sesión. Vuelve a probar desde la dirección principal del juego.",
  google_failed: "Google no respondió bien al entrar. Prueba otra vez en un momento.",
  google_in_use: "Esa cuenta de Google ya está vinculada a otro usuario de la app.",
  google_disabled: "Esta cuenta está desactivada. Habla con el anfitrión.",
  google_host: "La cuenta de anfitrión entra solo con su contraseña y su código.",
};

const SHELF_TITLE_ID = "estanteria";
const PAUSED_NOTICE = "El modo sin cuenta está en mantenimiento. Vuelve a probar en un rato.";

export default function Home() {
  const confirm = useConfirm();
  const toast = useToast();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  /** No se pudo saber quién usa la app (API caída): se dice y se ofrece reintentar. */
  const [accessError, setAccessError] = useState<string | null>(null);
  const [list, setList] = useState<GameList | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Formulario para canjear una invitación (cuentas gratis), abierto desde el pie de la estantería. */
  const [redeeming, setRedeeming] = useState(false);

  const refresh = useCallback(async () => {
    setList(null);
    try {
      setAccess(await api<AccessStatus>("/api/access/status"));
      setAccessError(null);
    } catch (err) {
      setAccess(null);
      setAccessError(errorText(err));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    // Lee el resultado del login de Spotify o Google una vez al montar (viene en la URL).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (code) setLoginError(LOGIN_ERRORS[code] ?? LOGIN_ERRORS.failed);
    if (params.get("google") === "linked") toast({ text: "Google vinculado: ya puedes entrar con él." });
    if (code || params.has("google")) window.history.replaceState(null, "", "/");
    refresh();
  }, [refresh, toast]);

  // La estantería solo aparece con sesión o tras elegir jugar sin cuenta.
  const view = accessError ? "error" : !access ? "loading" : access.user ? "account" : access.guest ? "guest" : "connect";
  const showsShelf = view === "account" || view === "guest";

  const loadList = useCallback(async () => {
    try {
      setList(await api<GameList>("/api/games?limit=12"));
      setListError(null);
    } catch (err) {
      setListError(errorText(err));
    }
  }, []);
  useEffect(() => {
    // La estantería se pide al saber quién es (viene del servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showsShelf) loadList();
  }, [showsShelf, access, loadList]);

  /** El botón que abrió la confirmación desaparece al borrar: el foco vuelve al título de la estantería. */
  const focusShelf = () => document.getElementById(SHELF_TITLE_ID)?.focus();

  /** Borra un casete de la estantería, con confirmación. */
  const deleteGame = async (game: GameSummary) => {
    const label = catalogLabel(game.catalogNumber);
    const ok = await confirm({
      title: `¿Borrar el casete ${label}?`,
      body:
        game.status === "FINISHED"
          ? "Se borra con su podio y sus rondas. No se puede deshacer."
          : "Está a medio grabar: se borra sin terminar. No se puede deshacer.",
      confirmLabel: "Borrar casete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api(`/api/games/${game.id}`, { method: "DELETE" });
      toast({ text: `Casete ${label} borrado.` });
    } catch (err) {
      toast({ text: errorText(err), tone: "error" });
    }
    await loadList();
    focusShelf();
  };

  /** Vacía toda la estantería del usuario o invitado (pide escribir BORRAR). */
  const deleteHistory = async () => {
    const total = list?.total ?? 0;
    const ok = await confirm({
      title: "¿Borrar todo tu historial?",
      body: (
        <>
          Se borran <strong>{total === 1 ? "el único casete" : `los ${total} casetes`}</strong> de tu estantería, con sus
          podios. Las partidas de otras personas no se tocan. No se puede deshacer.
        </>
      ),
      confirmLabel: "Borrar historial",
      tone: "danger",
      typeToConfirm: "BORRAR",
    });
    if (!ok) return;
    try {
      const { deleted } = await api<{ deleted: number }>("/api/games", { method: "DELETE", json: { confirm: "BORRAR" } });
      toast({ text: deleted === 1 ? "1 casete borrado. La estantería está vacía." : `${deleted} casetes borrados. La estantería está vacía.` });
    } catch (err) {
      toast({ text: errorText(err), tone: "error" });
    }
    await loadList();
    focusShelf();
  };

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
  const unlinkGoogle = async () => {
    const ok = await confirm({
      title: "¿Desvincular tu Google?",
      body: "Seguirás entrando con tu usuario y contraseña.",
      confirmLabel: "Desvincular",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api("/api/auth/google/unlink", { method: "POST" });
      toast({ text: "Google desvinculado." });
    } catch (err) {
      toast({ text: errorText(err), tone: "error" });
    }
    await refresh();
  };
  const redeemed = async () => {
    setRedeeming(false);
    toast({ text: "Invitación canjeada: ya puedes usar el modo Spotify." });
    await refresh();
  };

  const user = access?.user ?? null;

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
      <BandStatus text={status} />
      <main className={styles.main}>
        {view === "loading" && <p className={styles.loading}>Rebobinando…</p>}
        {view === "error" && (
          <div className={styles.errorWrap}>
            <RetryNotice message={`No pudimos conectar con el juego. ${accessError}`} onRetry={refresh} />
          </div>
        )}
        {view === "connect" && (
          <Connect
            error={loginError ?? notice}
            paused={!!access?.openModePaused}
            googleEnabled={!!access?.googleEnabled}
            onGuest={playAsGuest}
            onSignedIn={refresh}
          />
        )}
        {view === "account" && (
          <Shelf
            list={list}
            listError={listError}
            onRetryList={loadList}
            onDelete={deleteGame}
            onDeleteAll={deleteHistory}
            premium={access?.spotify?.premium ?? null}
            newGameHref={access?.spotify ? "/nueva" : "/nueva?modo=abierto"}
            notice={loginError}
            aside={redeeming && <RedeemInvite onDone={redeemed} onCancel={() => setRedeeming(false)} />}
            footer={
              <>
                {user?.role === "host" && (
                  <Link href="/anfitrion" className={styles.linkBtn}>
                    Panel del anfitrión
                  </Link>
                )}
                {access?.spotify ? (
                  <button type="button" className={styles.linkBtn} onClick={unlinkSpotify}>
                    Desvincular Spotify
                  </button>
                ) : user?.spotifyAllowed ? (
                  <a href="/api/auth/login" className={styles.linkBtn}>
                    Conectar mi Spotify
                  </a>
                ) : (
                  !redeeming && (
                    <button type="button" className={styles.linkBtn} onClick={() => setRedeeming(true)}>
                      ¿Tienes una invitación?
                    </button>
                  )
                )}
                {access?.googleEnabled && user?.role === "member" && !user.google && (
                  <a href="/api/auth/google/login" className={styles.linkBtn}>
                    Vincular Google
                  </a>
                )}
                {user?.google && user.hasPassword && (
                  <button type="button" className={styles.linkBtn} onClick={unlinkGoogle}>
                    Desvincular Google
                  </button>
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
            listError={listError}
            onRetryList={loadList}
            onDelete={deleteGame}
            onDeleteAll={deleteHistory}
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
  googleEnabled,
  onGuest,
  onSignedIn,
}: {
  error: string | null;
  paused: boolean;
  googleEnabled: boolean;
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
        <AccountCard
          key={account}
          initialTab={account}
          googleEnabled={googleEnabled}
          onDone={onSignedIn}
          onCancel={() => setAccount(null)}
        />
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
  listError,
  onRetryList,
  onDelete,
  onDeleteAll,
  aside,
  premium,
  newGameHref,
  notice,
  footer,
}: {
  list: GameList | null;
  /** La estantería no cargó: aviso con «Reintentar» en vez de decir que está vacía. */
  listError: string | null;
  onRetryList: () => Promise<void>;
  onDelete: (game: GameSummary) => void;
  onDeleteAll: () => void;
  /** Bloque extra encima de los casetes (p. ej. canjear una invitación). */
  aside?: ReactNode;
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
          <h1 className={styles.shelfTitle} id={SHELF_TITLE_ID} tabIndex={-1}>
            Tu estantería
          </h1>
          <p className={styles.shelfSub}>
            {listError
              ? "No se pudo leer la estantería"
              : list
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

      {aside}

      {listError && (
        <div className={styles.shelfNotice}>
          <RetryNotice message={`No se pudieron cargar tus casetes. ${listError}`} onRetry={onRetryList} />
        </div>
      )}

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
                  <span className={styles.spineTags}>
                    <span className={styles.spineMeta}>
                      {g.mode === "open" ? "Sin cuenta · 30 s · " : ""}
                      {formatDate(g.createdAt)}
                    </span>
                    <button
                      type="button"
                      className={styles.spineDelete}
                      onClick={() => onDelete(g)}
                      aria-label={`Borrar el casete ${catalogLabel(g.catalogNumber)}`}
                      title="Borrar casete"
                    >
                      <Trash2 size={20} aria-hidden />
                    </button>
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

      <div className={styles.foot}>
        {count > 0 && (
          <button type="button" className={styles.linkBtn} onClick={onDeleteAll}>
            Borrar mi historial
          </button>
        )}
        {footer}
      </div>
    </>
  );
}

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : "No se pudo conectar. Prueba otra vez.";
}
