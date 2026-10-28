"use client";

import { Check, Heart } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { Playlist } from "@/lib/client/api";
import styles from "./songs.module.css";

export const LIKED_ID = "liked";

/**
 * Una playlist como casete: la etiqueta de cartulina lleva el nombre escrito a mano (dos líneas como
 * mucho; el nombre completo va en el `title`), la ventana sus bobinas y la boca el número de canciones.
 * Elegida, lleva el borde de azafrán y las bobinas giran.
 */
export function PlaylistCassette({ p, on, onToggle }: { p: Playlist; on: boolean; onToggle: () => void }) {
  const { m } = useI18n();
  const t = m.setup;
  const name = p.id === LIKED_ID ? t.likedSongs : p.name || t.untitled;
  const songs = p.totalTracks !== null ? t.songs(p.totalTracks) : null;
  const owner = !p.readable && p.owner ? t.byOwner(p.owner) : null;
  const details = [name, songs, owner].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      className={styles.cassette}
      aria-pressed={on}
      aria-label={details}
      title={!p.readable ? `${details}. ${t.othersPlaylistTitle}` : details}
      disabled={p.needsReconnect || !p.readable}
      onClick={onToggle}
    >
      <span className={styles.label}>
        <span className={styles.name}>
          {p.id === LIKED_ID && <Heart size={16} strokeWidth={3} aria-hidden />}
          {name}
        </span>
        <span className={styles.window} aria-hidden>
          <span className={styles.reel} />
          <span className={styles.reel} />
        </span>
      </span>
      <span className={styles.mouth} aria-hidden>
        {[songs, owner].filter(Boolean).join(" · ") || " "}
      </span>
      {on && (
        <span className={styles.picked} aria-hidden>
          <Check size={18} strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}
