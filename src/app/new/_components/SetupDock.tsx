"use client";

import { Shuffle } from "lucide-react";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import { peopleCount, playerNames, type SetupForm } from "@/lib/game/setup";
import styles from "../setup.module.css";

/** Barra fija de abajo: resumen de la partida, por qué aún no se puede grabar, «Probar filtros» y «Grabar». */
export function SetupDock({
  form: f,
  problem,
  busy,
  canTry,
  editing,
  onTry,
  onStart,
  blocked,
}: {
  form: SetupForm;
  /** El error de la API o lo que impide grabar. */
  problem: string | null;
  busy: boolean;
  canTry: boolean;
  editing: boolean;
  onTry: () => void;
  onStart: () => void;
  blocked: boolean;
}) {
  const { m, locale } = useI18n();
  const t = m.setup;
  const people = peopleCount(f);
  const names = playerNames(f).length;
  const who =
    f.format === "teams"
      ? `${t.teamsCount(f.teams.length)} · ${people ? plural(locale, people, t.people) : t.noPeople}`
      : names
        ? plural(locale, names, t.players)
        : t.noPlayers;
  return (
    <div className={styles.dock}>
      <div className={styles.dockInner}>
        <div>
          <div className={styles.summary}>
            {who} · {plural(locale, f.rounds, t.roundsCount)} · {t.perSong(f.mode === "open" ? 30 : f.fragmentSeconds)}
          </div>
          {problem && (
            <div className={styles.why} role="status">
              {problem}
            </div>
          )}
        </div>
        <div className={styles.dockActions}>
          <button type="button" className={`${ui.btn} ${ui.onShell}`} onClick={onTry} disabled={busy || !canTry}>
            <Shuffle size={22} aria-hidden />
            {t.tryFilters}
          </button>
          <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={onStart} disabled={busy || blocked}>
            {editing ? t.saveAndBack : t.recordAndStart}
          </button>
        </div>
      </div>
    </div>
  );
}
