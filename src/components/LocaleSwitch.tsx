"use client";

import { chooseLocale, useI18n } from "@/i18n/client";
import { LOCALE_NAMES, LOCALES } from "@/i18n/locales";
import styles from "./TopBar.module.css";

/** «ES · EN» en la banda: guarda el idioma en una cookie y recarga la página en ese idioma. */
export function LocaleSwitch() {
  const { m, locale } = useI18n();
  return (
    <div className={styles.locales} role="group" aria-label={m.common.language}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          className={styles.locale}
          aria-pressed={l === locale}
          aria-label={LOCALE_NAMES[l]}
          onClick={() => l !== locale && chooseLocale(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
