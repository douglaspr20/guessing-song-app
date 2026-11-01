"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Card } from "@/components/Card";
import { RetryNotice } from "@/components/RetryNotice";
import form from "@/components/styles/form.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import type { ArtistPage } from "@/lib/artists/directory";
import { api, errorText } from "@/lib/client/api";
import { MAX_ARTISTS, type ChosenArtist } from "@/lib/game/filters";
import styles from "./ArtistPicker.module.css";

/** Espera tras dejar de escribir antes de buscar. */
const SEARCH_DELAY_MS = 300;

/**
 * El directorio de artistas para elegir con quién jugar: buscador, rejilla de tarjetas (foto o portada y nombre),
 * páginas y una barra fija abajo con los elegidos. Lo usan el paso «Elegir artistas» de /new y la página /artists.
 */
export function ArtistPicker({
  source,
  genres,
  language = "",
  yearFrom,
  yearTo,
  selected,
  onChange,
  title,
  intro,
  filters,
  doneLabel,
  onDone,
  backLabel,
  onBack,
}: {
  /** De dónde salen: Spotify (con la cuenta conectada) o iTunes. `null` mientras se sabe: espera sin pedir nada. */
  source: "spotify" | "itunes" | null;
  genres: string[];
  /** Idioma de la música (decide la tienda y el listado sin géneros). */
  language?: string;
  /** Época: solo artistas con canciones entre esos años. */
  yearFrom?: number;
  yearTo?: number;
  selected: ChosenArtist[];
  onChange: (artists: ChosenArtist[]) => void;
  title: string;
  /** Línea bajo el título (p. ej. «Filtrado por Pop latino»). */
  intro?: ReactNode;
  /** Controles extra encima de la rejilla (en /artists: géneros y época). */
  filters?: ReactNode;
  doneLabel: string;
  onDone: () => void;
  backLabel: string;
  onBack: () => void;
}) {
  const { m, locale } = useI18n();
  const t = m.artists;
  const searchId = useId();
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ArtistPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  // Busca al dejar de escribir; una búsqueda nueva vuelve a la primera página.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(typed.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [typed]);

  const genreKey = genres.join(",");
  // Otros géneros, idioma, época o fuente: otra lista, desde el principio.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPage(1), [genreKey, language, yearFrom, yearTo, source]);

  useEffect(() => {
    if (!source) return;
    let alive = true;
    const params = new URLSearchParams({ source, genres: genreKey, language, q, page: String(page) });
    if (yearFrom) params.set("yearFrom", String(yearFrom));
    if (yearTo) params.set("yearTo", String(yearTo));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api<ArtistPage>(`/api/artists?${params}`).then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (!alive) return;
        setError(errorText(e));
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [source, genreKey, language, yearFrom, yearTo, q, page, reloads]);

  // Por id: dos artistas pueden llamarse igual (y con el nombre como clave React mezclaba tarjetas al actualizar).
  const isChosen = (id: string) => selected.some((s) => s.id === id);
  const full = selected.length >= MAX_ARTISTS;
  const toggle = (a: ChosenArtist) =>
    onChange(isChosen(a.id) ? selected.filter((s) => s.id !== a.id) : full ? selected : [...selected, { id: a.id, name: a.name }]);

  return (
    <>
      <main className={styles.main}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ChevronLeft size={22} aria-hidden />
          {backLabel}
        </button>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.intro}>
          {intro} {source === "spotify" ? t.introSpotify : source === "itunes" ? t.introItunes : null}
        </p>

        <Card className={styles.controls}>
          <div className={styles.controlsBody}>
            <label className={form.field} htmlFor={searchId}>
              <span className={form.label}>{t.search}</span>
              <span className={styles.searchBox}>
                <Search size={22} aria-hidden className={styles.searchIcon} />
                <input
                  id={searchId}
                  type="search"
                  className={`${form.input} ${styles.searchInput}`}
                  placeholder={t.searchPlaceholder}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                />
              </span>
            </label>
            {filters}
          </div>
        </Card>

        {full && <p className={styles.max}>{t.max(MAX_ARTISTS)}</p>}

        {error && !loading ? (
          <RetryNotice message={t.cantLoad(error)} onRetry={() => setReloads((n) => n + 1)} />
        ) : (
          <>
            <ul className={styles.grid} aria-busy={loading} aria-label={loading ? t.loading : title}>
              {loading || !data
                ? Array.from({ length: 12 }, (_, i) => (
                    <li key={i} className={styles.skeleton} aria-hidden>
                      <span className={styles.cover} />
                      <span className={styles.skeletonName} />
                    </li>
                  ))
                : data.artists.map((a) => {
                    const on = isChosen(a.id);
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={styles.card}
                          aria-pressed={on}
                          aria-label={on ? t.remove(a.name) : t.choose(a.name)}
                          disabled={!on && full}
                          onClick={() => toggle(a)}
                        >
                          <span className={styles.cover}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- Imágenes de iTunes/Spotify ya a 300 px, como las portadas del juego. */}
                            {a.image && <img src={a.image} alt="" loading="lazy" />}
                            {on && (
                              <span className={styles.tick} aria-hidden>
                                <Check size={22} strokeWidth={3} />
                              </span>
                            )}
                          </span>
                          <span className={styles.name}>{a.name}</span>
                        </button>
                      </li>
                    );
                  })}
            </ul>
            {!loading && data && !data.artists.length && <p className={styles.empty}>{q ? t.empty : t.emptyNoQuery}</p>}
            {data && (data.page > 1 || data.hasMore) && (
              <nav className={styles.pager} aria-label={title}>
                <button type="button" className={`${ui.btn} ${ui.onShell}`} disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={20} aria-hidden />
                  {t.prev}
                </button>
                <span className={styles.pageLabel}>{data.pages ? t.pageOf(data.page, data.pages) : t.page(data.page)}</span>
                <button type="button" className={`${ui.btn} ${ui.onShell}`} disabled={loading || !data.hasMore} onClick={() => setPage((p) => p + 1)}>
                  {t.next}
                  <ChevronRight size={20} aria-hidden />
                </button>
              </nav>
            )}
          </>
        )}
      </main>

      <div className={styles.dock}>
        <div className={styles.dockInner}>
          <p className={styles.count}>{selected.length ? plural(locale, selected.length, t.chosen) : t.noneChosen}</p>
          <button type="button" className={`${ui.btn} ${ui.primary} ${styles.done}`} onClick={onDone}>
            {doneLabel}
          </button>
          {selected.length > 0 && (
            <ul className={styles.chips}>
              {selected.map((a) => (
                <li key={a.id}>
                  <button type="button" className={styles.chip} onClick={() => toggle(a)} aria-label={t.remove(a.name)}>
                    {a.name}
                    <X size={16} strokeWidth={3} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
