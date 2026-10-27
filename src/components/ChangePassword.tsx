"use client";

import { useId, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/client/api";
import { Card } from "./Card";
import { Field } from "./Field";
import { Notice } from "./Notice";
import form from "./styles/form.module.css";
import ui from "./ui.module.css";
import access from "./access.module.css";
import styles from "./RedeemInvite.module.css";

/**
 * Cambiar la contraseña (o ponerla, si la cuenta solo entra con Google). Si el anfitrión la
 * restableció, el formulario aparece solo y no se puede cerrar hasta poner una propia.
 */
export function ChangePassword({
  hasPassword,
  forced = false,
  onDone,
  onCancel,
}: {
  hasPassword: boolean;
  forced?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { m } = useI18n();
  const a = m.access;
  const ids = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const { busy, error, setError, run } = useAsyncAction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== repeat) return setError(a.passwordsDontMatch);
    const ok = await run(() =>
      api("/api/account/password", { json: { current: hasPassword ? current : undefined, next } }).then(() => true),
    );
    if (ok) onDone();
  };

  const title = forced ? a.forcedTitle : hasPassword ? a.changeTitle : a.setTitle;
  const lede = forced ? a.forcedLede : hasPassword ? a.changeLede : a.setLede;

  return (
    <Card className={styles.card} aria-labelledby={`${ids}-title`}>
      <form className={styles.body} onSubmit={submit}>
        <div className={styles.copy}>
          <h2 className={access.title} id={`${ids}-title`}>
            {title}
          </h2>
          <p className={access.lede}>{lede}</p>
        </div>
        <div className={`${styles.field} ${styles.fields}`}>
          {hasPassword && (
            <Field label={forced ? a.temporaryPassword : a.currentPassword}>
              <input
                className={form.input}
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                maxLength={200}
                required
                autoFocus
              />
            </Field>
          )}
          <Field label={a.newPassword} hint={a.passwordHint}>
            <input
              className={form.input}
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
              autoFocus={!hasPassword}
            />
          </Field>
          <Field label={a.repeatPassword}>
            <input
              className={form.input}
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
            />
          </Field>
        </div>
        <div className={`${form.actions} ${styles.actions}`}>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
            <KeyRound size={22} aria-hidden />
            {busy ? a.saving : a.savePassword}
          </button>
          {!forced && onCancel && (
            <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onCancel}>
              {m.common.cancel}
            </button>
          )}
        </div>
        {error && <Notice className={styles.error}>{error}</Notice>}
      </form>
    </Card>
  );
}
