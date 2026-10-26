"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Info, Plus, Play, Trash2 } from "lucide-react";
import { AccountCard, type AccountTab } from "@/components/AccountCard";
import { Cassette } from "@/components/Cassette";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { ChangePassword } from "@/components/ChangePassword";
import { RedeemInvite } from "@/components/RedeemInvite";
import { RetryNotice } from "@/components/RetryNotice";
import { Podium } from "@/components/Podium";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import {
  api,
  ApiError,
  catalogLabel,
  type AccessStatus,
  type GameList,
  type GameSummary,
  errorText,
} from "@/lib/client/api";
import { formatDate, formatList, plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import styles from "./home.module.css";

const SHELF_TITLE_ID = "estanteria";

export default function Home() {
  const { m, locale } = useI18n();
  const t = m.home;
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
  /** Formulario para cambiar (o poner) la contraseña, abierto desde el pie de la estantería. */
  const [changingPassword, setChangingPassword] = useState(false);

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
    if (code) setLoginError(t.loginErrors[code] ?? t.loginErrors.failed);
    if (params.get("google") === "linked") toast({ text: t.googleLinked });
    if (code || params.has("google")) window.history.replaceState(null, "", "/");
    refresh();
  }, [refresh, toast, t]);

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
      title: t.deleteTitle(label),
      body:
        game.status === "FINISHED"
          ? t.deleteFinished
          : t.deleteUnfinished,
      confirmLabel: t.deleteConfirm,
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api(`/api/games/${game.id}`, { method: "DELETE" });
      toast({ text: t.deleted(label) });
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
      title: t.deleteAllTitle,
      body: (
        <>
          {t.deleteAllBefore} <strong>{plural(locale, total, t.deleteAllCount)}</strong> {t.deleteAllAfter}
        </>
      ),
      confirmLabel: t.deleteAllConfirm,
      tone: "danger",
      typeToConfirm: t.deleteAllWord,
    });
    if (!ok) return;
    try {
      const { deleted } = await api<{ deleted: number }>("/api/games", { method: "DELETE", json: { confirm: "BORRAR" } });
      toast({ text: plural(locale, deleted, t.deletedAll) });
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
      setNotice(err instanceof ApiError ? err.message : t.cantStart);
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
      title: t.unlinkGoogleTitle,
      body: t.unlinkGoogleBody,
      confirmLabel: t.unlink,
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api("/api/auth/google/unlink", { method: "POST" });
      toast({ text: t.googleUnlinked });
    } catch (err) {
      toast({ text: errorText(err), tone: "error" });
    }
    await refresh();
  };
  const redeemed = async () => {
    setRedeeming(false);
    toast({ text: t.inviteRedeemed });
    await refresh();
  };

  const passwordChanged = async () => {
    setChangingPassword(false);
    toast({ text: t.passwordSaved });
    await refresh();
  };

  const user = access?.user ?? null;
  // Si el anfitrión la restableció, el formulario aparece solo hasta que se ponga una propia.
  const passwordForm =
    user?.mustChangePassword || changingPassword ? (
      <ChangePassword
        hasPassword={user?.hasPassword ?? false}
        forced={!!user?.mustChangePassword}
        onDone={passwordChanged}
        onCancel={() => setChangingPassword(false)}
      />
    ) : null;

  const status =
    view === "account" && access?.user
      ? access.spotify
        ? `${access.user.displayName} · Spotify`
        : access.user.displayName
      : view === "guest"
        ? t.guestStatus
        : undefined;

  return (
    <div className={styles.page}>
      <BandStatus text={status} />
      <main className={styles.main}>
        {view === "loading" && <p className={styles.loading}>{m.common.loading}</p>}
        {view === "error" && (
          <div className={styles.errorWrap}>
            <RetryNotice message={t.cantConnectGame(accessError ?? "")} onRetry={refresh} />
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
            aside={passwordForm ?? (redeeming && <RedeemInvite onDone={redeemed} onCancel={() => setRedeeming(false)} />)}
            footer={
              <>
                <Link href="/unirse" className={styles.linkBtn}>
                  {t.joinGame}
                </Link>
                {user?.role === "host" && (
                  <Link href="/anfitrion" className={styles.linkBtn}>
                    {t.hostPanel}
                  </Link>
                )}
                {access?.spotify ? (
                  <button type="button" className={styles.linkBtn} onClick={unlinkSpotify}>
                    {t.unlinkSpotify}
                  </button>
                ) : user?.spotifyAllowed ? (
                  <a href="/api/auth/login" className={styles.linkBtn}>
                    {t.connectSpotify}
                  </a>
                ) : (
                  !redeeming && (
                    <button type="button" className={styles.linkBtn} onClick={() => setRedeeming(true)}>
                      {t.haveInvite}
                    </button>
                  )
                )}
                {access?.googleEnabled && user?.role === "member" && !user.google && (
                  <a href="/api/auth/google/login" className={styles.linkBtn}>
                    {t.linkGoogle}
                  </a>
                )}
                {user?.role === "member" && !passwordForm && (
                  <button type="button" className={styles.linkBtn} onClick={() => setChangingPassword(true)}>
                    {user.hasPassword ? t.changePassword : t.setPassword}
                  </button>
                )}
                {user?.google && user.hasPassword && (
                  <button type="button" className={styles.linkBtn} onClick={unlinkGoogle}>
                    {t.unlinkGoogle}
                  </button>
                )}
                <button type="button" className={styles.linkBtn} onClick={signOut}>
                  {t.signOut}
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
            notice={access?.openModePaused ? t.paused : null}
            footer={
              <>
                <Link href="/unirse" className={styles.linkBtn}>
                  {t.joinGame}
                </Link>
                <button type="button" className={styles.linkBtn} onClick={leaveGuest}>
                  {t.backToStart}
                </button>
              </>
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
  const { m } = useI18n();
  const t = m.home;
  const [account, setAccount] = useState<AccountTab | null>(null);
  return (
    <section className={styles.connect}>
      <div>
        <h1 className={styles.headline}>
          {t.headline}
          <br />
          <em>{t.headlineEm}</em>
        </h1>
        <p className={styles.lede}>
          {t.ledeBefore} <strong>{t.ledeStrong}</strong> {t.ledeAfter}
        </p>
        <div className={styles.actions}>
          <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={onGuest} disabled={paused}>
            {t.playAsGuest}
          </button>
          <button type="button" className={`${ui.btn} ${ui.onShell} ${ui.big}`} onClick={() => setAccount("login")}>
            {t.signIn}
          </button>
          <Link href="/unirse" className={`${ui.btn} ${ui.onShell} ${ui.big}`}>
            {t.joinWithCode}
          </Link>
        </div>
        <p className={styles.req}>
          <Info size={20} aria-hidden />
          <span>
            {paused ? t.paused : t.guestInfo}{" "}
            <button type="button" className={styles.inlineLink} onClick={() => setAccount("invite")}>
              {t.haveInvite}
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
          title={t.demoTitle}
          value={
            <>
              {t.demoWorth} <b>{t.demoPoints}</b>
            </>
          }
          remainingMs={30_000}
          progress={0}
          running={false}
          caption={t.demoCaption}
          hints={[
            { key: "words", label: m.game.hintLabels.words, at: "10 s", value: null, unlocked: false },
            { key: "artist", label: m.game.hintLabels.artist, at: "20 s", value: null, unlocked: false },
            { key: "letters", label: m.game.hintLabels.letters, at: "25 s", value: null, unlocked: false },
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
  const { m, locale } = useI18n();
  const t = m.home;
  const count = list?.total ?? 0;
  return (
    <>
      <div className={styles.shelfHead}>
        <div>
          <h1 className={styles.shelfTitle} id={SHELF_TITLE_ID} tabIndex={-1}>
            {t.shelfTitle}
          </h1>
          <p className={styles.shelfSub}>
            {listError
              ? t.shelfUnreadable
              : list
                ? count
                  ? plural(locale, count, t.recorded)
                  : t.noCassettes
                : t.searchingCassettes}
          </p>
        </div>
        <Link href={newGameHref} className={`${ui.btn} ${ui.primary} ${ui.big}`}>
          <Plus size={28} strokeWidth={3} aria-hidden />
          {t.newGame}
        </Link>
      </div>

      {aside}

      {listError && (
        <div className={styles.shelfNotice}>
          <RetryNotice message={t.cantLoadCassettes(listError)} onRetry={onRetryList} />
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
          {t.notPremium}
        </p>
      )}

      {list && list.games.length === 0 && (
        <div className={styles.emptyShelf}>
          <div className={styles.spineBand} />
          <p className={styles.emptyText}>
            <strong>{t.emptyStrong}</strong>
            {t.emptyText}
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
                      {g.mode === "open" ? t.guestMode : ""}
                      {formatDate(locale, g.createdAt)}
                    </span>
                    <button
                      type="button"
                      className={styles.spineDelete}
                      onClick={() => onDelete(g)}
                      aria-label={t.deleteCassette(catalogLabel(g.catalogNumber))}
                      title={t.deleteCassetteTitle}
                    >
                      <Trash2 size={20} aria-hidden />
                    </button>
                  </span>
                </div>
                <div className={styles.spineBody}>
                  <div className={styles.spineInfo}>
                    <span className={styles.meta}>
                      {t.tracksPlayed(g.playedRounds, g.totalRounds)} ·{" "}
                      {g.format === "teams"
                        ? `${t.teamsCount(g.playerCount)} · ${plural(locale, g.peopleCount, t.people)}`
                        : plural(locale, g.playerCount, t.players)}
                    </span>
                    {finished ? (
                      <span className={styles.winner}>
                        {winner && winner.score > 0
                          ? tied.length > 1
                            ? t.tie(formatList(locale, tied.map((p) => p.name)))
                            : t.winner(winner.name)
                          : t.nobodyScored}
                      </span>
                    ) : (
                      <>
                        <span className={styles.badge}>{t.unfinished}</span>
                        <Link href={`/partida/${g.id}`} className={`${ui.btn} ${ui.onCard} ${styles.resume}`}>
                          <Play size={20} aria-hidden />
                          {t.keepPlaying}
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
            {t.deleteHistory}
          </button>
        )}
        {footer}
      </div>
    </>
  );
}

