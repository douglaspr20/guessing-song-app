import { z } from "zod";
import { LANGUAGES } from "@/lib/spotify/catalog";

const languageIds = LANGUAGES.map((l) => l.id) as [string, ...string[]];
const currentYear = new Date().getFullYear();
const year = z.number().int().min(1900).max(currentYear + 1);

export const gameFiltersSchema = z
  .object({
    /** De dónde salen las canciones: búsqueda con filtros o playlists propias. */
    source: z.enum(["search", "playlists"]).default("search"),
    genres: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    /** Idioma aproximado (se traduce a un mercado). */
    language: z.enum(languageIds).optional(),
    /** Mercado explícito (código ISO de país). Tiene prioridad sobre `language`. */
    market: z
      .string()
      .regex(/^[A-Z]{2}$/, "Código de país ISO de 2 letras")
      .optional(),
    yearFrom: year.optional(),
    yearTo: year.optional(),
    /** Texto libre extra para la búsqueda (p. ej. "en español", un artista...). */
    keywords: z.string().trim().max(100).optional(),
    /** Popularidad mínima (0-100), solo si Spotify la devuelve. */
    minPopularity: z.number().int().min(0).max(100).optional(),
    playlistIds: z.array(z.string().min(1)).max(20).default([]),
  })
  .refine((f) => f.source !== "playlists" || f.playlistIds.length > 0, {
    message: "Elige al menos una playlist",
    path: ["playlistIds"],
  })
  .refine((f) => !f.yearFrom || !f.yearTo || f.yearFrom <= f.yearTo, {
    message: "yearFrom debe ser menor o igual que yearTo",
    path: ["yearFrom"],
  });

export type GameFilters = z.infer<typeof gameFiltersSchema>;

export const MIN_FRAGMENT_SECONDS = 60;
export const MAX_FRAGMENT_SECONDS = 180;

export const createGameSchema = z.object({
  players: z
    .array(z.string().trim().min(1).max(30))
    .min(1)
    .max(20)
    .refine((names) => new Set(names.map((n) => n.toLowerCase())).size === names.length, {
      message: "Los nombres de los jugadores deben ser distintos",
    }),
  rounds: z.number().int().min(1).max(50),
  fragmentSeconds: z.number().int().min(MIN_FRAGMENT_SECONDS).max(MAX_FRAGMENT_SECONDS).default(MIN_FRAGMENT_SECONDS),
  filters: gameFiltersSchema.default({ source: "search", genres: [], playlistIds: [] }),
});

export type CreateGameInput = z.input<typeof createGameSchema>;
