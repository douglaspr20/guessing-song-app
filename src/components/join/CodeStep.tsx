"use client";

import type { FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { RetryNotice } from "@/components/RetryNotice";
import form from "@/components/styles/form.module.css";
import access from "@/components/access.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import styles from "./JoinFlow.module.css";

/** Primer paso: escribir (o pegar) el código de 6 caracteres de la partida. */
export function CodeStep({
  titleId,
  code,
  onCode,
  busy,
  error,
  offline,
  onRetry,
  onSubmit,
}: {
  titleId: string;
  code: string;
  onCode: (value: string) => void;
  busy: boolean;
  error: string | null;
  /** La API no respondió: aviso con «Reintentar». */
  offline: boolean;
  onRetry: () => Promise<unknown>;
  onSubmit: (e: FormEvent) => void;
}) {
  const { m } = useI18n();
  const j = m.join;
  const errorId = `${titleId}-err`;
  return (
    <form className={access.body} onSubmit={onSubmit}>
      <div>
        <h1 className={access.title} id={titleId}>
          {j.title}
        </h1>
        <p className={access.lede}>{j.lede}</p>
      </div>
      <Field label={j.codeLabel}>
        <input
          className={`${form.input} ${styles.code}`}
          value={code}
          onChange={(e) => onCode(e.target.value)}
          placeholder="· · · · · ·"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          aria-describedby={error ? errorId : undefined}
        />
      </Field>
      {error && <Notice id={errorId}>{error}</Notice>}
      {offline && <RetryNotice message={j.cantCheck} onRetry={onRetry} />}
      <div className={form.actions}>
        <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.big}`} disabled={busy || code.length !== 6}>
          <ArrowRight size={24} aria-hidden />
          {busy ? j.searching : j.continue}
        </button>
      </div>
    </form>
  );
}
