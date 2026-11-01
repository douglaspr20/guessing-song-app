"use client";

import Link from "next/link";
import { useState } from "react";
import { BandStatus } from "@/components/band/BandStatus";
import { ChangePassword } from "@/components/ChangePassword";
import { MadeBy } from "@/components/MadeBy";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import { RedeemInvite } from "@/components/RedeemInvite";
import { RetryNotice } from "@/components/RetryNotice";
import { useI18n } from "@/i18n/client";
import { api, ApiError, type AccessStatus, type GameList } from "@/lib/client/api";
import { AccountFooter } from "./AccountFooter";
import { Connect } from "./Connect";
import { Shelf } from "./Shelf";
import { useAccess } from "../_hooks/useAccess";
import { useShelf } from "../_hooks/useShelf";
import styles from "../home.module.css";

/**
 * Portada: bienvenida sin sesión, o la estantería de casetes (con cuenta o como invitado). Quién es y sus casetes los
 * lee el servidor (`access` null o `listFailed` si no pudo); cada cambio le pide que los vuelva a leer.
 */
export function HomeClient({
  access,
  list,
  listFailed,
}: {
  access: AccessStatus | null;
  list: GameList | null;
  listFailed: boolean;
}) {
  const { m } = useI18n();
  const t = m.home;
  const toast = useToast();
  const act = useConfirmedAction();
  const { loginError, view, refresh } = useAccess(access);
  const shelf = useShelf(list, refresh);
  const [notice, setNotice] = useState<string | null>(null);
  /** Formulario para canjear una invitación (cuentas gratis), abierto desde el pie de la estantería. */
  const [redeeming, setRedeeming] = useState(false);
  /** Formulario para cambiar (o poner) la contraseña, abierto desde el pie de la estantería. */
  const [changingPassword, setChangingPassword] = useState(false);

  /** Llama a la API sin avisar de errores (salir, desvincular) y vuelve a leer quién es. */
  const quietly = (url: string, method: "POST" | "DELETE") => async () => {
    await api(url, { method }).catch(() => undefined);
    await refresh();
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
  const unlinkGoogle = () =>
    act({
      question: { title: t.unlinkGoogleTitle, body: t.unlinkGoogleBody, confirmLabel: t.unlink, tone: "danger" },
      run: () => api("/api/auth/google/unlink", { method: "POST" }),
      done: t.googleUnlinked,
      after: refresh,
    });
  const closeForm = (close: () => void, text: string) => async () => {
    close();
    toast({ text });
    await refresh();
  };

  const user = access?.user ?? null;
  // Si el anfitrión la restableció, el formulario aparece solo hasta que se ponga una propia.
  const passwordForm =
    user?.mustChangePassword || changingPassword ? (
      <ChangePassword
        hasPassword={user?.hasPassword ?? false}
        forced={!!user?.mustChangePassword}
        onDone={closeForm(() => setChangingPassword(false), t.passwordSaved)}
        onCancel={() => setChangingPassword(false)}
      />
    ) : null;

  const status =
    view === "account" && user
      ? access?.spotify
        ? `${user.displayName} · Spotify`
        : user.displayName
      : view === "guest"
        ? t.guestStatus
        : undefined;

  const shelfProps = {
    list,
    listError: listFailed ? m.common.cantConnect : null,
    onRetryList: refresh,
    onDelete: shelf.deleteGame,
    onDeleteAll: shelf.deleteHistory,
  };

  return (
    <div className={styles.page}>
      <BandStatus text={status} />
      <main className={styles.main}>
        {view === "error" && (
          <div className={styles.errorWrap}>
            <RetryNotice message={t.cantConnectGame(m.common.cantConnect)} onRetry={refresh} />
          </div>
        )}
        {view === "connect" && (
          <>
            <Connect
              error={loginError ?? notice}
              paused={!!access?.openModePaused}
              googleEnabled={!!access?.googleEnabled}
              onGuest={playAsGuest}
              onSignedIn={refresh}
            />
            <MadeBy className={styles.connectCredit} />
          </>
        )}
        {view === "account" && user && access && (
          <Shelf
            {...shelfProps}
            premium={access.spotify?.premium ?? null}
            newGameHref={access.spotify ? "/new" : "/new?mode=open"}
            notice={loginError}
            aside={
              passwordForm ??
              (redeeming && (
                <RedeemInvite
                  onDone={closeForm(() => setRedeeming(false), t.inviteRedeemed)}
                  onCancel={() => setRedeeming(false)}
                />
              ))
            }
            footer={
              <AccountFooter
                user={user}
                access={access}
                redeeming={redeeming}
                passwordOpen={!!passwordForm}
                onUnlinkSpotify={quietly("/api/auth/logout", "POST")}
                onRedeem={() => setRedeeming(true)}
                onChangePassword={() => setChangingPassword(true)}
                onUnlinkGoogle={unlinkGoogle}
                onSignOut={quietly("/api/account/logout", "POST")}
              />
            }
          />
        )}
        {view === "guest" && (
          <Shelf
            {...shelfProps}
            premium={null}
            newGameHref="/new?mode=open"
            notice={access?.openModePaused ? t.paused : null}
            footer={
              <>
                <Link href="/join" className={styles.linkBtn}>
                  {t.joinGame}
                </Link>
                <button type="button" className={styles.linkBtn} onClick={quietly("/api/guest", "DELETE")}>
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

/** Mientras el servidor lee quién es: el mismo «Rebobinando…» de siempre (sin datos de la petición, va en el shell). */
export function HomeLoading() {
  const { m } = useI18n();
  return (
    <div className={styles.page}>
      <BandStatus />
      <main className={styles.main}>
        <p className={styles.loading}>{m.common.loading}</p>
      </main>
    </div>
  );
}
