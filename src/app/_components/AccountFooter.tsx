"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import type { AccessStatus } from "@/lib/client/api";
import styles from "../home.module.css";

type User = NonNullable<AccessStatus["user"]>;

/** Pie de la estantería con cuenta: unirse, panel, Spotify, invitación, Google, contraseña y salir. */
export function AccountFooter({
  user,
  access,
  redeeming,
  passwordOpen,
  onUnlinkSpotify,
  onRedeem,
  onChangePassword,
  onUnlinkGoogle,
  onSignOut,
}: {
  user: User;
  access: AccessStatus;
  /** El formulario de invitación ya está abierto (no se repite el enlace). */
  redeeming: boolean;
  passwordOpen: boolean;
  onUnlinkSpotify: () => void;
  onRedeem: () => void;
  onChangePassword: () => void;
  onUnlinkGoogle: () => void;
  onSignOut: () => void;
}) {
  const { m } = useI18n();
  const t = m.home;
  return (
    <>
      <Link href="/join" className={styles.linkBtn}>
        {t.joinGame}
      </Link>
      {user.role === "host" && (
        <Link href="/host" className={styles.linkBtn}>
          {t.hostPanel}
        </Link>
      )}
      {access.spotify ? (
        <button type="button" className={styles.linkBtn} onClick={onUnlinkSpotify}>
          {t.unlinkSpotify}
        </button>
      ) : user.spotifyAllowed ? (
        <a href="/api/auth/login" className={styles.linkBtn}>
          {t.connectSpotify}
        </a>
      ) : (
        !redeeming && (
          <button type="button" className={styles.linkBtn} onClick={onRedeem}>
            {t.haveInvite}
          </button>
        )
      )}
      {access.googleEnabled && user.role === "member" && !user.google && (
        <a href="/api/auth/google/login" className={styles.linkBtn}>
          {t.linkGoogle}
        </a>
      )}
      {user.role === "member" && !passwordOpen && (
        <button type="button" className={styles.linkBtn} onClick={onChangePassword}>
          {user.hasPassword ? t.changePassword : t.setPassword}
        </button>
      )}
      {user.google && user.hasPassword && (
        <button type="button" className={styles.linkBtn} onClick={onUnlinkGoogle}>
          {t.unlinkGoogle}
        </button>
      )}
      <button type="button" className={styles.linkBtn} onClick={onSignOut}>
        {t.signOut}
      </button>
    </>
  );
}
