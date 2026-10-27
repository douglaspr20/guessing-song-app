"use client";

import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, Ticket } from "lucide-react";
import { api, errorText } from "@/lib/client/api";
import { useI18n } from "@/i18n/client";
import ui from "./ui.module.css";
import access from "./access.module.css";
import styles from "./RedeemInvite.module.css";

/** Una cuenta gratis canjea el código que le dio el anfitrión y gana el modo Spotify. */
export function RedeemInvite({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { m } = useI18n();
  const a = m.access;
  const ids = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/invite", { json: { invite: code } });
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${ui.card} ${styles.card}`} aria-labelledby={`${ids}-title`}>
      <div className={ui.cardStripes} />
      <form className={styles.body} onSubmit={submit}>
        <div className={styles.copy}>
          <h2 className={access.title} id={`${ids}-title`}>
            {a.redeemTitle}
          </h2>
          <p className={access.lede}>{a.redeemLede}</p>
        </div>
        <label className={`${access.field} ${styles.field}`}>
          <span className={access.label}>{a.inviteCode}</span>
          <input
            className={`${access.input} ${access.code}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD-EFGH-JKMN"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            autoFocus
          />
        </label>
        <div className={`${access.actions} ${styles.actions}`}>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
            <Ticket size={22} aria-hidden />
            {busy ? a.checking : a.redeem}
          </button>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onCancel}>
            {m.common.cancel}
          </button>
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
