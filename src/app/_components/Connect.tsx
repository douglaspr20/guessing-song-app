"use client";

import Link from "next/link";
import { useState } from "react";
import { Info } from "lucide-react";
import { AccountCard, type AccountTab } from "@/components/AccountCard";
import { Cassette } from "@/components/Cassette";
import { Notice } from "@/components/Notice";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import styles from "../home.module.css";

/** Bienvenida sin sesión: titular, jugar sin cuenta, entrar o unirse; a la derecha el casete de muestra o el formulario. */
export function Connect({
  error,
  paused,
  googleEnabled,
  onGuest,
  onSignedIn,
}: {
  error: string | null;
  paused: boolean;
  googleEnabled: boolean;
  onGuest: () => void;
  onSignedIn: () => void;
}) {
  // Al pulsar «Entrar» o «Tengo una invitación», la carátula del formulario ocupa el sitio del casete.
  const { m } = useI18n();
  const t = m.home;
  const [account, setAccount] = useState<AccountTab | null>(null);
  return (
    <section className={styles.connect}>
      <div>
        <h1 className={styles.headline}>
          {t.headline}
          <br />
          <em>{t.headlineEm}</em>
        </h1>
        <p className={styles.lede}>
          {t.ledeBefore} <strong>{t.ledeStrong}</strong> {t.ledeAfter}
        </p>
        <div className={styles.actions}>
          <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={onGuest} disabled={paused}>
            {t.playAsGuest}
          </button>
          <button type="button" className={`${ui.btn} ${ui.onShell} ${ui.big}`} onClick={() => setAccount("login")}>
            {t.signIn}
          </button>
          <Link href="/join" className={`${ui.btn} ${ui.onShell} ${ui.big}`}>
            {t.joinWithCode}
          </Link>
        </div>
        <p className={styles.req}>
          <Info size={20} aria-hidden />
          <span>
            {paused ? t.paused : t.guestInfo}{" "}
            <button type="button" className={styles.inlineLink} onClick={() => setAccount("invite")}>
              {t.haveInvite}
            </button>
          </span>
        </p>
        {error && (
          <Notice on="shell" className={styles.error}>
            {error}
          </Notice>
        )}
      </div>
      {account ? (
        <AccountCard
          key={account}
          initialTab={account}
          googleEnabled={googleEnabled}
          onDone={onSignedIn}
          onCancel={() => setAccount(null)}
        />
      ) : (
        <Cassette
          title={t.demoTitle}
          value={
            <>
              {t.demoWorth} <b>{t.demoPoints}</b>
            </>
          }
          remainingMs={30_000}
          progress={0}
          running={false}
          caption={t.demoCaption}
          hints={[
            { key: "words", label: m.game.hintLabels.words, at: "10 s", value: null, unlocked: false },
            { key: "artist", label: m.game.hintLabels.artist, at: "20 s", value: null, unlocked: false },
            { key: "letters", label: m.game.hintLabels.letters, at: "25 s", value: null, unlocked: false },
          ]}
        />
      )}
    </section>
  );
}
