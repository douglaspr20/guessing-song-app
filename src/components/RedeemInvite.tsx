"use client";

import { useId, useState, type FormEvent } from "react";
import { Ticket } from "lucide-react";
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

/** Una cuenta gratis canjea el código que le dio el anfitrión y gana el modo Spotify. */
export function RedeemInvite({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { m } = useI18n();
  const a = m.access;
  const ids = useId();
  const [code, setCode] = useState("");
  const { busy, error, run } = useAsyncAction();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => api("/api/account/invite", { json: { invite: code } }).then(() => true));
    if (ok) onDone();
  };

  return (
    <Card className={styles.card} aria-labelledby={`${ids}-title`}>
      <form className={styles.body} onSubmit={submit}>
        <div className={styles.copy}>
          <h2 className={access.title} id={`${ids}-title`}>
            {a.redeemTitle}
          </h2>
          <p className={access.lede}>{a.redeemLede}</p>
        </div>
        <Field label={a.inviteCode} className={styles.field}>
          <input
            className={`${form.input} ${form.code}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD-EFGH-JKMN"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            autoFocus
          />
        </Field>
        <div className={`${form.actions} ${styles.actions}`}>
          <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
            <Ticket size={22} aria-hidden />
            {busy ? a.checking : a.redeem}
          </button>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onCancel}>
            {m.common.cancel}
          </button>
        </div>
        {error && <Notice className={styles.error}>{error}</Notice>}
      </form>
    </Card>
  );
}
