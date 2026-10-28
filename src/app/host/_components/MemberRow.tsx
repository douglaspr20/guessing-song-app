"use client";

import type { ConfirmOptions } from "@/components/feedback/FeedbackProvider";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import controls from "@/components/styles/controls.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { formatDate, plural } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import { api } from "@/lib/client/api";
import type { Member } from "../_lib/types";
import styles from "../host.module.css";
import { ListItem, RevealedSecret } from "./PanelBits";

const BTN = `${ui.btn} ${ui.onCard} ${controls.small}`;

/** Un miembro: su resumen y los botones de desactivar, Spotify, contraseña, sesiones, historial y borrar. */
export function MemberRow({
  member: mb,
  reset,
  onResetPassword,
  onChanged,
}: {
  member: Member;
  /** Contraseña temporal recién creada para este miembro (se enseña una sola vez). */
  reset: { username: string; password: string } | null;
  onResetPassword: () => void;
  onChanged: () => Promise<void>;
}) {
  const { m, locale } = useI18n();
  const h = m.host;
  const act = useConfirmedAction();
  const patch = (json: unknown) => () => api(`/api/host/members/${mb.id}`, { method: "PATCH", json });
  const run = (call: () => Promise<unknown>, done: string, question?: ConfirmOptions) =>
    act({ question, run: call, done, after: onChanged });

  return (
    <ListItem
      title={
        <>
          {mb.displayName} <span className={styles.itemMeta}>@{mb.username}</span>
        </>
      }
      meta={
        <>
          {mb.disabled ? h.disabledPrefix : ""}
          {loginMethod(mb, h)} · {mb.spotifyAllowed ? h.withInvite : h.freeAccount} ·{" "}
          {mb.spotify !== null ? h.spotifyOf(mb.spotify) : h.noSpotify} · {plural(locale, mb.games, h.games)}
          {mb.lastSeenAt ? h.seenOn(formatDate(locale, mb.lastSeenAt)) : ""}
        </>
      }
      actions={
        <>
          <button
            type="button"
            className={BTN}
            onClick={() =>
              run(
                patch({ disabled: !mb.disabled }),
                mb.disabled ? h.canEnterAgain(mb.username) : h.cantEnter(mb.username),
                mb.disabled
                  ? undefined
                  : { title: h.disableTitle(mb.username), body: h.disableBody, confirmLabel: h.disable, tone: "danger" },
              )
            }
          >
            {mb.disabled ? h.enable : h.disable}
          </button>
          <button
            type="button"
            className={BTN}
            onClick={() =>
              run(
                patch({ spotifyAllowed: !mb.spotifyAllowed }),
                mb.spotifyAllowed ? h.spotifyRemoved(mb.username) : h.spotifyGranted(mb.username),
                mb.spotifyAllowed
                  ? {
                      title: h.removeSpotifyTitle(mb.username),
                      body: h.removeSpotifyBody,
                      confirmLabel: h.removeSpotify,
                      tone: "danger",
                    }
                  : { title: h.grantSpotifyTitle(mb.username), body: h.grantSpotifyBody, confirmLabel: h.grantSpotify },
              )
            }
          >
            {mb.spotifyAllowed ? h.removeSpotify : h.grantSpotify}
          </button>
          <button type="button" className={BTN} onClick={onResetPassword}>
            {mb.hasPassword ? h.resetPassword : h.createPassword}
          </button>
          {mb.sessions > 0 && (
            <button type="button" className={BTN} onClick={() => run(patch({ revokeSessions: true }), h.sessionsClosed(mb.username))}>
              {h.closeSessions}
            </button>
          )}
          {mb.games > 0 && (
            <button
              type="button"
              className={BTN}
              onClick={() =>
                run(() => api(`/api/host/members/${mb.id}/games`, { method: "DELETE" }), h.historyDeleted(mb.username), {
                  title: h.deleteHistoryTitle(mb.username),
                  body: (
                    <>
                      {h.deleteHistoryBefore} <strong>{plural(locale, mb.games, h.games)}</strong>
                      {h.deleteHistoryAfter}
                    </>
                  ),
                  confirmLabel: h.deleteHistory,
                  tone: "danger",
                  typeToConfirm: m.home.deleteAllWord,
                })
              }
            >
              {h.deleteHistory}
            </button>
          )}
          <button
            type="button"
            className={`${BTN} ${styles.danger}`}
            onClick={() =>
              run(() => api(`/api/host/members/${mb.id}`, { method: "DELETE" }), h.memberDeleted(mb.username), {
                title: h.deleteMemberTitle(mb.username),
                body: h.deleteMemberBody,
                confirmLabel: h.deleteMember,
                tone: "danger",
                typeToConfirm: m.home.deleteAllWord,
              })
            }
          >
            {h.delete}
          </button>
        </>
      }
      below={
        reset && <RevealedSecret fullRow label={h.tempPassword(reset.username)} value={reset.password} note={h.tempPasswordHint} />
      }
    />
  );
}

/** Cómo entra cada miembro: con Google, con contraseña o de las dos formas. */
function loginMethod(mb: Member, h: Messages["host"]) {
  if (mb.google && mb.hasPassword) return h.loginGoogleAndPassword(mb.google);
  if (mb.google) return h.loginGoogle(mb.google);
  return h.loginPassword;
}
