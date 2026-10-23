"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import access from "@/components/access.module.css";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { errorMessage } from "../_lib/useHostData";
import styles from "../host.module.css";

/** Entrada del anfitrión: contraseña y código de la app de autenticación. */
export function HostLogin({ onDone }: { onDone: () => void }) {
  const ids = useId();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/host/login", { json: { password, code } });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.loginWrap}>
      <section className={`${ui.card} ${access.card}`} aria-labelledby={`${ids}-title`}>
        <div className={ui.cardStripes} />
        <form className={access.body} onSubmit={submit}>
          <div>
            <h1 className={access.title} id={`${ids}-title`}>
              Anfitrión
            </h1>
            <p className={access.lede}>Contraseña y código de tu app de autenticación.</p>
          </div>
          <label className={access.field}>
            <span className={access.label}>Contraseña</span>
            <input
              className={access.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={200}
              required
            />
          </label>
          <label className={access.field}>
            <span className={access.label}>Código de 6 dígitos</span>
            <input
              className={`${access.input} ${access.code}`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              placeholder="000000"
              required
            />
          </label>
          {error && (
            <p className={`${ui.notice} ${ui.noticeErrorOnCard}`} role="alert">
              <AlertTriangle size={20} aria-hidden />
              {error}
            </p>
          )}
          <div className={access.actions}>
            <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
              <ShieldCheck size={22} aria-hidden />
              {busy ? "Comprobando…" : "Entrar"}
            </button>
            <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
              Volver
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
