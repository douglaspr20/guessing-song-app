"use client";

import { useId, useState, type FormEvent } from "react";
import { LogIn, Ticket } from "lucide-react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/client/api";
import { Card } from "./Card";
import { Field } from "./Field";
import { Notice } from "./Notice";
import { Segmented } from "./Segmented";
import form from "./styles/form.module.css";
import ui from "./ui.module.css";
import styles from "./access.module.css";

export type AccountTab = "login" | "invite";

/** Entrar con usuario y contraseña, o crear la cuenta con un código de invitación. */
export function AccountCard({
  initialTab = "login",
  googleEnabled = false,
  onDone,
  onCancel,
}: {
  initialTab?: AccountTab;
  /** Hay credenciales de Google: se ofrece entrar (o crear la cuenta gratis) con Google. */
  googleEnabled?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { m } = useI18n();
  const a = m.access;
  const ids = useId();
  const [tab, setTab] = useState<AccountTab>(initialTab);
  const [invite, setInvite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAsyncAction();
  const registering = tab === "invite";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      if (registering) await api("/api/account/register", { json: { invite, username, password } });
      else await api("/api/account/login", { json: { username, password } });
      return true;
    });
    if (ok) onDone();
  };

  return (
    <Card className={styles.card} aria-labelledby={`${ids}-title`}>
      <form className={styles.body} onSubmit={submit}>
        <Segmented
          fill
          label={a.kindOfAccess}
          value={tab}
          onChange={setTab}
          options={[
            { value: "login", label: a.tabLogin },
            { value: "invite", label: a.tabInvite },
          ]}
        />

        <div>
          <h2 className={styles.title} id={`${ids}-title`}>
            {registering ? a.createTitle : a.loginTitle}
          </h2>
          <p className={styles.lede}>{registering ? a.createLede : googleEnabled ? a.loginLedeGoogle : a.loginLede}</p>
        </div>

        {googleEnabled && (
          <>
            {/* Navegación completa: Google necesita la redirección real, no un fetch. */}
            <a href="/api/auth/google/login" className={`${ui.btn} ${ui.onCard} ${styles.google}`}>
              <GoogleMark />
              {a.continueWithGoogle}
            </a>
            <p className={styles.or}>{registering ? a.orWithInvite : a.orWithUser}</p>
          </>
        )}

        {registering && (
          <Field label={a.inviteCode}>
            <input
              className={`${form.input} ${form.code}`}
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="ABCD-EFGH-JKMN"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </Field>
        )}
        <Field label={a.username}>
          <input
            className={form.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={registering ? a.usernameHint : ""}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={30}
            required
          />
        </Field>
        <Field label={a.password} hint={registering && a.passwordHint}>
          <input
            className={form.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 8 : undefined}
            maxLength={200}
            required
          />
        </Field>

        {error && <Notice>{error}</Notice>}

        <div className={form.actions}>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
            {registering ? <Ticket size={22} aria-hidden /> : <LogIn size={22} aria-hidden />}
            {busy ? m.common.oneMoment : registering ? a.createAccount : a.signIn}
          </button>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onCancel}>
            {m.common.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}

/** Logotipo «G» de Google (sus cuatro colores, como piden sus normas de marca). */
function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
