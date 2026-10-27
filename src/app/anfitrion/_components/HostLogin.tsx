"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import form from "@/components/styles/form.module.css";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import access from "@/components/access.module.css";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { useI18n } from "@/i18n/client";
import styles from "../host.module.css";

/** Entrada del anfitrión: contraseña y código de la app de autenticación. */
export function HostLogin({ onDone }: { onDone: () => void }) {
  const { m } = useI18n();
  const a = m.access;
  const ids = useId();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const { busy, error, run } = useAsyncAction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => api("/api/host/login", { json: { password, code } }).then(() => true));
    // Un código fallido ya no sirve: se vacía para escribir el siguiente.
    if (ok) onDone();
    else setCode("");
  };

  return (
    <div className={styles.loginWrap}>
      <Card className={access.card} aria-labelledby={`${ids}-title`}>
        <form className={access.body} onSubmit={submit}>
          <div>
            <h1 className={access.title} id={`${ids}-title`}>
              {a.hostTitle}
            </h1>
            <p className={access.lede}>{a.hostLede}</p>
          </div>
          <Field label={a.password}>
            <input
              className={form.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={200}
              required
            />
          </Field>
          <Field label={a.sixDigitCode}>
            <input
              className={`${form.input} ${form.code}`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              placeholder="000000"
              required
            />
          </Field>
          {error && <Notice>{error}</Notice>}
          <div className={form.actions}>
            <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
              <ShieldCheck size={22} aria-hidden />
              {busy ? a.checking : a.signIn}
            </button>
            <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
              {a.back}
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
