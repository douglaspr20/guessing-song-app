"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BandStatus } from "@/components/band/BandStatus";
import { Card } from "@/components/Card";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useI18n } from "@/i18n/client";
import { api, type Game } from "@/lib/client/api";
import { buildFilters, createGameBody, effectiveSource, setupBlocker } from "@/lib/game/setup";
import { PlayersCard } from "./_components/PlayersCard";
import { PhoneSettings, PlaySettings, SourceSettings } from "./_components/PlaySettings";
import { SetupDock } from "./_components/SetupDock";
import { PlaylistPicker, SearchFilters } from "./_components/SongFilters";
import { useEditPrefill, useSetupData, useSetupForm } from "./_hooks/useSetup";
import styles from "./setup.module.css";

// useSearchParams (?edit=) necesita un límite de Suspense.
export default function NewGamePage() {
  return (
    <Suspense>
      <NewGame />
    </Suspense>
  );
}

/** Grabar una partida nueva (o cambiar los ajustes de una aún sin empezar, con ?edit=). */
function NewGame() {
  const router = useRouter();
  const { m } = useI18n();
  const t = m.setup;
  const searchParams = useSearchParams();
  /** Partida aún sin empezar que se está editando (desde «Editar ajustes» del juego). */
  const editId = searchParams.get("edit");
  const { form, update } = useSetupForm(searchParams.get("mode") === "open" ? "open" : "spotify", t);
  const { catalog, playlists, connected, canLink } = useSetupData(() => update({ mode: "open" }));
  useEditPrefill(editId, update);
  const { busy, error, run } = useAsyncAction();
  const [sample, setSample] = useState<string | null>(null);
  const settingsId = useId();

  const open = form.mode === "open";
  const source = effectiveSource(form);
  // Solo cuentan las playlists que Spotify deja leer (una partida editada puede traer alguna ajena).
  const usableIds = form.playlistIds.filter((id) => !playlists || playlists.find((p) => p.id === id)?.readable);
  const blocker = setupBlocker(form, usableIds, t);

  const start = async () => {
    if (blocker) return;
    const game = await run(async () => {
      const created = await api<Game>("/api/games", { json: createGameBody(form, usableIds) });
      // Al editar se graba un casete nuevo y se tira el anterior (aún no tenía pistas).
      if (editId) await api(`/api/games/${editId}`, { method: "DELETE" }).catch(() => {});
      return created;
    });
    // Next conserva esta página al navegar: sin borrar la muestra se vería al volver.
    setSample(null);
    if (game) router.push(`/game/${game.id}`);
  };

  const tryFilters = async () => {
    setSample(null);
    const r = await run(() =>
      api<{ track: { name: string; artists: string[] } }>("/api/spotify/sample", {
        json: { mode: form.mode, filters: buildFilters(form, usableIds), fragmentSeconds: form.fragmentSeconds },
      }),
    );
    if (r) setSample(`${r.track.name} — ${r.track.artists.join(", ")}`);
  };

  return (
    <>
      <BandStatus text={editId ? t.bandEditing : t.bandNew} />
      <main className={styles.main}>
        <Link href="/" className={styles.back}>
          <ArrowLeft size={22} aria-hidden />
          {m.common.backToShelf}
        </Link>
        <h1 className={styles.title}>{editId ? t.titleEditing : t.titleNew}</h1>

        <div className={styles.grid}>
          <PlayersCard form={form} update={update} />

          <Card aria-labelledby={settingsId}>
            <div className={styles.panel}>
              <PlaySettings titleId={settingsId} form={form} update={update} canLink={canLink} connected={connected} />
              <PhoneSettings form={form} update={update} />
              {!open && <SourceSettings form={form} update={update} />}
              {source === "search" ? (
                <SearchFilters form={form} update={update} catalog={catalog} />
              ) : (
                <PlaylistPicker form={form} update={update} playlists={playlists} usableCount={usableIds.length} />
              )}
              {sample && (
                <p className={styles.sample}>
                  {t.sampleBefore} <strong>{sample}</strong>
                </p>
              )}
            </div>
          </Card>
        </div>
      </main>

      <SetupDock
        form={form}
        problem={error ?? blocker}
        busy={busy}
        canTry={source !== "playlists" || usableIds.length > 0}
        editing={!!editId}
        blocked={!!blocker}
        onTry={tryFilters}
        onStart={start}
      />
    </>
  );
}
