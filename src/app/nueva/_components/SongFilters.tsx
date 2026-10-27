"use client";

import { Check, Heart } from "lucide-react";
import { Chip, chipsClass } from "@/components/Chip";
import { Field } from "@/components/Field";
import form from "@/components/styles/form.module.css";
import { useI18n } from "@/i18n/client";
import type { Catalog, Playlist } from "@/lib/client/api";
import type { SetupForm } from "@/lib/game/setup";
import styles from "../setup.module.css";

const LIKED_ID = "liked";
const MAX_GENRES = 10;

type Props = { form: SetupForm; update: (patch: (form: SetupForm) => Partial<SetupForm>) => void };

const toggled = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
const digits = (value: string) => value.replace(/\D/g, "").slice(0, 4);

/** Búsqueda general: géneros (hasta 10), idioma de la música, años y palabra clave. */
export function SearchFilters({ form: f, update, catalog }: Props & { catalog: Catalog | null }) {
  const { m } = useI18n();
  const t = m.setup;
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={form.label}>{t.genres}</h3>
          <span className={styles.hint}>{f.genres.length ? t.genresChosen(f.genres.length) : t.anyGenre}</span>
        </div>
        <div className={chipsClass}>
          {catalog?.genres.map((g) => {
            const on = f.genres.includes(g);
            return (
              <Chip
                key={g}
                pressed={on}
                onClick={() => update((s) => ({ genres: toggled(s.genres, g) }))}
                disabled={!on && f.genres.length >= MAX_GENRES}
              >
                {on && <Check size={16} strokeWidth={3} aria-hidden />}
                {g}
              </Chip>
            );
          })}
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.inline}>
          <Field label={t.language}>
            <select className={styles.select} value={f.language} onChange={(e) => update(() => ({ language: e.target.value }))}>
              <option value="">{t.anyLanguage}</option>
              {catalog?.languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {t.musicLanguages[l.id] ?? l.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.from}>
            <input
              className={`${form.input} ${styles.year}`}
              inputMode="numeric"
              placeholder="1980"
              value={f.yearFrom}
              onChange={(e) => update(() => ({ yearFrom: digits(e.target.value) }))}
            />
          </Field>
          <Field label={t.to}>
            <input
              className={`${form.input} ${styles.year}`}
              inputMode="numeric"
              placeholder="1999"
              value={f.yearTo}
              onChange={(e) => update(() => ({ yearTo: digits(e.target.value) }))}
            />
          </Field>
        </div>
        <Field label={t.keyword} className={styles.keyword}>
          <input
            className={form.input}
            placeholder={t.keywordPlaceholder}
            value={f.keywords}
            maxLength={100}
            onChange={(e) => update(() => ({ keywords: e.target.value }))}
          />
        </Field>
        <p className={`${styles.hint} ${styles.languageHint}`}>{t.languageHint}</p>
      </div>
    </>
  );
}

/** Mis playlists: las que Spotify deja leer arriba; las de otras personas aparte, desactivadas y explicadas. */
export function PlaylistPicker({
  form: f,
  update,
  playlists,
  usableCount,
}: Props & { playlists: Playlist[] | null; usableCount: number }) {
  const { m } = useI18n();
  const t = m.setup;
  const chip = (p: Playlist) => (
    <PlaylistChip
      key={p.id}
      p={p}
      on={f.playlistIds.includes(p.id)}
      onToggle={() => update((s) => ({ playlistIds: toggled(s.playlistIds, p.id) }))}
    />
  );
  const others = playlists?.filter((p) => !p.readable) ?? [];
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h3 className={form.label}>{t.playlists}</h3>
        <span className={styles.hint}>{t.playlistsChosen(usableCount)}</span>
      </div>
      {!playlists && <p className={styles.hint}>{t.loadingPlaylists}</p>}
      <div className={chipsClass}>{playlists?.filter((p) => p.readable).map(chip)}</div>
      {others.length > 0 && (
        <>
          <h3 className={`${form.label} ${styles.othersTitle}`}>{t.othersPlaylists}</h3>
          <p className={`${styles.hint} ${styles.othersHint}`}>{t.othersPlaylistsHint}</p>
          <div className={chipsClass}>{others.map(chip)}</div>
        </>
      )}
      {playlists?.some((p) => p.needsReconnect) && (
        <p className={`${styles.hint} ${styles.reconnect}`}>
          {t.reconnectBefore} <a href="/api/auth/login">{t.reconnectLink}</a>.
        </p>
      )}
    </div>
  );
}

function PlaylistChip({ p, on, onToggle }: { p: Playlist; on: boolean; onToggle: () => void }) {
  const { m } = useI18n();
  const t = m.setup;
  return (
    <Chip
      pressed={on}
      disabled={p.needsReconnect || !p.readable}
      title={!p.readable ? t.othersPlaylistTitle : undefined}
      onClick={onToggle}
    >
      {p.id === LIKED_ID && <Heart size={16} strokeWidth={3} aria-hidden />}
      {on && p.id !== LIKED_ID && <Check size={16} strokeWidth={3} aria-hidden />}
      {p.id === LIKED_ID ? t.likedSongs : p.name || t.untitled}
      {p.totalTracks !== null && <span aria-label={t.songs(p.totalTracks)}>· {p.totalTracks}</span>}
      {!p.readable && p.owner && <span className={styles.owner}>{t.byOwner(p.owner)}</span>}
    </Chip>
  );
}
