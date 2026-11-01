"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArtistPicker } from "@/components/artists/ArtistPicker";
import { BandStatus } from "@/components/band/BandStatus";
import { Chip, chipsClass } from "@/components/Chip";
import form from "@/components/styles/form.module.css";
import { useI18n } from "@/i18n/client";
import type { ChosenArtist } from "@/lib/game/filters";
import { DECADES, GENRES } from "@/lib/spotify/catalog";
import { GenreSpine, genreShelfClass } from "../../new/_components/GenreSpine";
import styles from "../artists.module.css";

const MAX_GENRES = 10;

/**
 * El directorio de artistas a mano, fuera de una partida: filtrar por géneros y época (solo con iTunes), buscar y
 * elegir. «Crear partida con estos artistas» lleva a /new con todo puesto. `source` llega del servidor (null mientras
 * lo lee: el listado espera, así no pide primero a iTunes y luego a Spotify).
 */
export function ArtistsClient({ source }: { source: "spotify" | "itunes" | null }) {
  const router = useRouter();
  const { m } = useI18n();
  const t = m.artists;
  const s = m.setup;
  const [genres, setGenres] = useState<string[]>([]);
  const [decade, setDecade] = useState<number | null>(null);
  const [selected, setSelected] = useState<ChosenArtist[]>([]);

  const toggle = (g: string) => setGenres((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]));
  const yearFrom = decade ?? undefined;
  const yearTo = decade === null ? undefined : decade + 9;

  const start = () => {
    const params = new URLSearchParams();
    if (selected.length) params.set("artists", JSON.stringify(selected));
    if (genres.length) params.set("genres", genres.join(","));
    if (yearFrom && yearTo) {
      params.set("yearFrom", String(yearFrom));
      params.set("yearTo", String(yearTo));
    }
    router.push(`/new${params.size ? `?${params}` : ""}`);
  };

  return (
    <>
      <BandStatus text={t.bandTitle} />
      <ArtistPicker
        source={source}
        genres={genres}
        yearFrom={yearFrom}
        yearTo={yearTo}
        selected={selected}
        onChange={setSelected}
        title={t.pageTitle}
        intro={t.intro}
        doneLabel={t.startWith}
        onDone={start}
        backLabel={m.common.backToShelf}
        onBack={() => router.push("/")}
        filters={
          <div className={styles.filters}>
            <div className={form.field}>
              <span className={form.label}>{s.genres}</span>
              <div className={genreShelfClass}>
                {GENRES.map((g) => {
                  const on = genres.includes(g);
                  return (
                    <GenreSpine
                      key={g}
                      label={s.genreLabels[g] ?? g}
                      on={on}
                      disabled={!on && genres.length >= MAX_GENRES}
                      onToggle={() => toggle(g)}
                    />
                  );
                })}
              </div>
            </div>
            {/* Solo con iTunes: el `year:` de Spotify no filtra artistas (con él no devuelve ninguno). */}
            {source === "itunes" && (
              <div className={form.field} role="group" aria-label={t.era}>
                <span className={form.label}>{t.era}</span>
                <div className={chipsClass}>
                  <Chip hand pressed={decade === null} onClick={() => setDecade(null)}>
                    {t.anyEra}
                  </Chip>
                  {DECADES.map((d) => (
                    <Chip key={d} hand pressed={decade === d} onClick={() => setDecade(decade === d ? null : d)}>
                      {t.decade(d)}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
