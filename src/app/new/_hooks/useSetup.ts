"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useState } from "react";
import type { Messages } from "@/i18n/messages";
import { api, type AccessStatus, type Catalog, type Game, type Playlist } from "@/lib/client/api";
import { MAX_ARTISTS, type GameMode } from "@/lib/game/filters";
import { initialSetup, parseChosenArtists, type SetupForm } from "@/lib/game/setup";
import { byPalette } from "@/lib/game/standings";
import { DEFAULT_TEAM_SIZE, DEFAULT_TEAMS, emptyTeams, type TeamDraft } from "@/lib/game/teams";

type Patch = Partial<SetupForm> | ((form: SetupForm) => Partial<SetupForm>);

/** El formulario entero en un solo estado; `update` mezcla cambios (o los calcula a partir del actual). */
export function useSetupForm(mode: GameMode, text: Messages["setup"]) {
  const [form, update] = useReducer(
    (state: SetupForm, patch: Patch) => ({ ...state, ...(typeof patch === "function" ? patch(state) : patch) }),
    undefined,
    () => initialSetup(emptyTeams(DEFAULT_TEAMS, text), mode),
  );
  return { form, update };
}

/**
 * Lo que viene del servidor para elegir: si hay Spotify (y si la cuenta puede usarlo), sus playlists y
 * el catálogo de géneros e idiomas. Sin Spotify, el formulario pasa al modo abierto.
 */
export function useSetupData(onNoSpotify: () => void) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  /** Con permiso de Spotify (invitación o anfitrión) se ofrece el modo; sin él, ni aparece. */
  const [canLink, setCanLink] = useState(false);

  useEffect(() => {
    api<AccessStatus>("/api/access/status").then(
      (a) => {
        setConnected(!!a.spotify);
        setCanLink(!!a.user?.spotifyAllowed);
        // Sin Spotify solo se puede jugar en modo abierto.
        if (!a.spotify) return onNoSpotify();
        api<{ playlists: Playlist[] }>("/api/spotify/playlists").then(
          (d) => setPlaylists(d.playlists),
          () => setPlaylists([]),
        );
      },
      () => {
        setConnected(false);
        onNoSpotify();
      },
    );
    api<Catalog>("/api/spotify/genres").then(setCatalog);
    // Una sola vez al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { catalog, playlists, connected, canLink };
}

/**
 * Desde el directorio de artistas (/artists): `/new?artists=[{"id":"spotify:…","name":"Shakira"}]&genres=pop&yearFrom=1980&
 * yearTo=1989` llega con esos artistas (y los géneros y la época con los que se filtró) ya puestos. Los artistas van en JSON
 * porque un nombre puede llevar comas («Earth, Wind & Fire») y hace falta su id.
 */
export function useArtistsPrefill(params: URLSearchParams, update: (patch: Partial<SetupForm>) => void) {
  const artists = params.get("artists");
  const genres = params.get("genres");
  const yearFrom = params.get("yearFrom");
  const yearTo = params.get("yearTo");
  useEffect(() => {
    if (!artists) return;
    const chosen = parseChosenArtists(artists);
    if (!chosen.length) return;
    const list = (v: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const year = (v: string | null) => (v && /^\d{4}$/.test(v) ? v : "");
    update({
      artists: chosen.slice(0, MAX_ARTISTS),
      genres: list(genres),
      yearFrom: year(yearFrom),
      yearTo: year(yearTo),
      source: "search",
    });
  }, [artists, genres, yearFrom, yearTo, update]);
}

/** Editar (desde «Editar ajustes» del juego): rellena el formulario con la partida aún sin empezar. */
export function useEditPrefill(editId: string | null, update: (patch: Partial<SetupForm>) => void) {
  const router = useRouter();
  useEffect(() => {
    if (!editId) return;
    api<Game>(`/api/games/${editId}`).then(
      (g) => {
        if (g.currentRound > 0) return router.replace(`/game/${g.id}`); // ya empezó: no se edita
        const who: Partial<SetupForm> =
          g.format === "teams"
            ? {
                format: "teams",
                maxTeamSize: g.maxTeamSize ?? DEFAULT_TEAM_SIZE,
                // Equipos en el orden de la paleta (el de creación).
                teams: [...g.players]
                  .sort(byPalette)
                  .map((p) => ({ name: p.name, color: p.color as TeamDraft["color"], members: p.members })),
              }
            : { players: g.players.map((p) => p.name) };
        update({
          ...who,
          rounds: g.totalRounds,
          answerSeconds: g.answerSeconds,
          lockout: g.lockout,
          freshGames: g.freshGames,
          fragmentSeconds: g.fragmentSeconds,
          mode: g.mode,
          source: g.filters.source,
          genres: g.filters.genres ?? [],
          language: g.filters.language ?? "",
          yearFrom: g.filters.yearFrom ? String(g.filters.yearFrom) : "",
          yearTo: g.filters.yearTo ? String(g.filters.yearTo) : "",
          keywords: g.filters.keywords ?? "",
          playlistIds: g.filters.playlistIds ?? [],
          artists: g.filters.artists ?? [],
          popularity: g.filters.popularity ?? "mix",
        });
      },
      () => router.replace("/new"),
    );
  }, [editId, router, update]);
}
