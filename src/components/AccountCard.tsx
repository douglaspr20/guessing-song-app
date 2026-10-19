"use client";

import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, LogIn, Ticket } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import ui from "./ui.module.css";
import styles from "./access.module.css";

export type AccountTab = "login" | "invite";

/** Entrar con usuario y contraseña, o crear la cuenta con un código de invitación. */
export function AccountCard({
  initialTab = "login",
  onDone,
  onCancel,
}: {
  initialTab?: AccountTab;
  onDone: () => void;
  onCancel: () => void;
}) {
  const ids = useId();
  const [tab, setTab] = useState<AccountTab>(initialTab);
  const [invite, setInvite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registering = tab === "invite";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (registering) await api("/api/account/register", { json: { invite, username, password } });
      else await api("/api/account/login", { json: { username, password } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar. Prueba otra vez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${ui.card} ${styles.card}`} aria-labelledby={`${ids}-title`}>
      <div className={ui.cardStripes} />
      <form className={styles.body} onSubmit={submit}>
        <div className={styles.tabs} role="group" aria-label="Tipo de acceso">
          <button type="button" aria-pressed={!registering} onClick={() => setTab("login")}>
            Entrar
          </button>
          <button type="button" aria-pressed={registering} onClick={() => setTab("invite")}>
            Tengo una invitación
          </button>
        </div>

        <div>
          <h2 className={styles.title} id={`${ids}-title`}>
            {registering ? "Crea tu cuenta" : "Entra a tu estantería"}
          </h2>
          <p className={styles.lede}>
            {registering
              ? "Con el código que te dio el anfitrión. Tus partidas solo las ves tú."
              : "Tus partidas y, si lo vinculas, tu Spotify."}
          </p>
        </div>

        {registering && (
          <label className={styles.field}>
            <span className={styles.label}>Código de invitación</span>
            <input
              className={`${styles.input} ${styles.code}`}
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="ABCD-EFGH-JKMN"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </label>
        )}
        <label className={styles.field}>
          <span className={styles.label}>Usuario</span>
          <input
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={registering ? "letras, números, _ o ." : ""}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={30}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Contraseña</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 8 : undefined}
            maxLength={200}
            required
          />
          {registering && <span className={styles.hint}>Al menos 8 caracteres. Mejor una frase que no uses en otro sitio.</span>}
        </label>

        {error && (
          <p className={`${ui.notice} ${ui.noticeErrorOnCard}`} role="alert">
            <AlertTriangle size={20} aria-hidden />
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
            {registering ? <Ticket size={22} aria-hidden /> : <LogIn size={22} aria-hidden />}
            {busy ? "Un momento…" : registering ? "Crear cuenta" : "Entrar"}
          </button>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
