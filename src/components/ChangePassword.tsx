"use client";

import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
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
  const ids = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== repeat) return setError("Las dos contraseñas nuevas no coinciden.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/password", { json: { current: hasPassword ? current : undefined, next } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar. Prueba otra vez.");
    } finally {
      setBusy(false);
    }
  };

  const title = forced ? "Pon una contraseña tuya" : hasPassword ? "Cambia tu contraseña" : "Ponle contraseña a tu cuenta";
  const lede = forced
    ? "El anfitrión te dio una contraseña temporal. Cámbiala ahora por una que solo sepas tú."
    : hasPassword
      ? "Al cambiarla se cierran tus sesiones en otros dispositivos."
      : "Así podrás entrar también con tu usuario, además de con Google.";

  return (
    <section className={`${ui.card} ${styles.card}`} aria-labelledby={`${ids}-title`}>
      <div className={ui.cardStripes} />
      <form className={styles.body} onSubmit={submit}>
        <div className={styles.copy}>
          <h2 className={access.title} id={`${ids}-title`}>
            {title}
          </h2>
          <p className={access.lede}>{lede}</p>
        </div>
        <div className={`${styles.field} ${styles.fields}`}>
          {hasPassword && (
            <label className={access.field}>
              <span className={access.label}>{forced ? "Contraseña temporal" : "Contraseña actual"}</span>
              <input
                className={access.input}
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                maxLength={200}
                required
                autoFocus
              />
            </label>
          )}
          <label className={access.field}>
            <span className={access.label}>Contraseña nueva</span>
            <input
              className={access.input}
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
              autoFocus={!hasPassword}
            />
            <span className={access.hint}>Al menos 8 caracteres. Mejor una frase que no uses en otro sitio.</span>
          </label>
          <label className={access.field}>
            <span className={access.label}>Repítela</span>
            <input
              className={access.input}
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={200}
              required
            />
          </label>
        </div>
        <div className={`${access.actions} ${styles.actions}`}>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
            <KeyRound size={22} aria-hidden />
            {busy ? "Guardando…" : "Guardar contraseña"}
          </button>
          {!forced && onCancel && (
            <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onCancel}>
              Cancelar
            </button>
          )}
        </div>
        {error && (
          <p className={`${ui.notice} ${ui.noticeErrorOnCard} ${styles.error}`} role="alert">
            <AlertTriangle size={20} aria-hidden />
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
