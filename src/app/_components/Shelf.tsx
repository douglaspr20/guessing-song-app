"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Play, Plus, Trash2, Users } from "lucide-react";
import { MadeBy } from "@/components/MadeBy";
import { Notice } from "@/components/Notice";
import { Podium } from "@/components/Podium";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { formatDate, formatList, plural } from "@/i18n/format";
import { catalogLabel, type GameList, type GameSummary } from "@/lib/client/api";
import { SHELF_TITLE_ID } from "../_hooks/useShelf";
import styles from "../home.module.css";

/** La estantería: título, «Grabar partida nueva», avisos, los casetes con su podio y el pie con enlaces. */
export function Shelf({
  list,
  listError,
  onRetryList,
  onDelete,
  onDeleteAll,
  aside,
  premium,
  newGameHref,
  notice,
  footer,
}: {
  list: GameList | null;
  /** La estantería no cargó: aviso con «Reintentar» en vez de decir que está vacía. */
  listError: string | null;
  onRetryList: () => Promise<void>;
  onDelete: (game: GameSummary) => void;
  onDeleteAll: () => void;
  /** Bloque extra encima de los casetes (p. ej. canjear una invitación). */
  aside?: ReactNode;
  premium: boolean | null;
  /** A qué formulario lleva «Grabar partida nueva» (sin Spotify, directo al modo abierto). */
  newGameHref: string;
  /** Aviso arriba de la estantería (error al conectar Spotify, mantenimiento…). */
  notice?: string | null;
  footer: ReactNode;
}) {
  const { m, locale } = useI18n();
  const t = m.home;
  const count = list?.total ?? 0;
  return (
    <>
      <div className={styles.shelfHead}>
        <div>
          <h1 className={styles.shelfTitle} id={SHELF_TITLE_ID} tabIndex={-1}>
            {t.shelfTitle}
          </h1>
          <p className={styles.shelfSub}>
            {listError
              ? t.shelfUnreadable
              : list
                ? count
                  ? plural(locale, count, t.recorded)
                  : t.noCassettes
                : t.searchingCassettes}
          </p>
        </div>
        <div className={styles.shelfActions}>
          <Link href="/artists" className={`${ui.btn} ${ui.onShell}`}>
            <Users size={22} aria-hidden />
            {m.artists.explore}
          </Link>
          <Link href={newGameHref} className={`${ui.btn} ${ui.primary} ${ui.big}`}>
            <Plus size={28} strokeWidth={3} aria-hidden />
            {t.newGame}
          </Link>
        </div>
      </div>

      {aside}

      {listError && (
        <div className={styles.shelfNotice}>
          <RetryNotice message={t.cantLoadCassettes(listError)} onRetry={onRetryList} />
        </div>
      )}

      {notice && (
        <Notice on="shell" className={styles.shelfNotice}>
          {notice}
        </Notice>
      )}

      {premium === false && (
        <Notice on="shell" className={styles.shelfNotice}>
          {t.notPremium}
        </Notice>
      )}

      {list && list.games.length === 0 && (
        <div className={styles.emptyShelf}>
          <div className={styles.spineBand} />
          <p className={styles.emptyText}>
            <strong>{t.emptyStrong}</strong>
            {t.emptyText}
          </p>
        </div>
      )}

      {list && list.games.length > 0 && (
        <ul className={styles.shelf}>
          {list.games.map((g) => (
            <ShelfSpine key={g.id} game={g} onDelete={() => onDelete(g)} />
          ))}
        </ul>
      )}

      <div className={styles.foot}>
        <MadeBy className={styles.footCredit} />
        {count > 0 && (
          <button type="button" className={styles.linkBtn} onClick={onDeleteAll}>
            {t.deleteHistory}
          </button>
        )}
        {footer}
      </div>
    </>
  );
}

/** Lomo de un casete: número de catálogo, fecha, cómo va o quién ganó, y su podio. */
function ShelfSpine({ game: g, onDelete }: { game: GameSummary; onDelete: () => void }) {
  const { m, locale } = useI18n();
  const t = m.home;
  const winner = g.podium[0];
  const finished = g.status === "FINISHED";
  const tied = g.podium.filter((p) => p.place === 1);
  return (
    <li className={styles.spine}>
      {/* Lomo del casete: rayas de borde a borde con el número de catálogo pegado. */}
      <div className={styles.spineBand}>
        <span className={styles.catalog}>{catalogLabel(g.catalogNumber)}</span>
        <span className={styles.spineTags}>
          <span className={styles.spineMeta}>
            {g.mode === "open" ? t.guestMode : ""}
            {formatDate(locale, g.createdAt)}
          </span>
          <button
            type="button"
            className={styles.spineDelete}
            onClick={onDelete}
            aria-label={t.deleteCassette(catalogLabel(g.catalogNumber))}
            title={t.deleteCassetteTitle}
          >
            <Trash2 size={20} aria-hidden />
          </button>
        </span>
      </div>
      <div className={styles.spineBody}>
        <div className={styles.spineInfo}>
          <span className={styles.meta}>
            {t.tracksPlayed(g.playedRounds, g.totalRounds)} ·{" "}
            {g.format === "teams"
              ? `${t.teamsCount(g.playerCount)} · ${plural(locale, g.peopleCount, t.people)}`
              : plural(locale, g.playerCount, t.players)}
          </span>
          {finished ? (
            <span className={styles.winner}>
              {winner && winner.score > 0
                ? tied.length > 1
                  ? t.tie(formatList(locale, tied.map((p) => p.name)))
                  : t.winner(winner.name)
                : t.nobodyScored}
            </span>
          ) : (
            <>
              <span className={styles.badge}>{t.unfinished}</span>
              <Link href={`/game/${g.id}`} className={`${ui.btn} ${ui.onCard} ${styles.resume}`}>
                <Play size={20} aria-hidden />
                {t.keepPlaying}
              </Link>
            </>
          )}
        </div>
        <div className={styles.spinePodium}>
          <Podium entries={g.podium} />
        </div>
      </div>
    </li>
  );
}
