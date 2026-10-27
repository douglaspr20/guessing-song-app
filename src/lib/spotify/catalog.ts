// Spotify retiró el endpoint de "genre seeds" para apps nuevas, así que la lista es fija.
// Son géneros que el filtro `genre:"..."` de la búsqueda reconoce bien.
export const GENRES = [
  "pop",
  "rock",
  "latin",
  "latin pop",
  "reggaeton",
  "salsa",
  "bachata",
  "merengue",
  "cumbia",
  "vallenato",
  "ranchera",
  "regional mexican",
  "rock en espanol",
  "flamenco",
  "hip hop",
  "rap",
  "r&b",
  "soul",
  "funk",
  "disco",
  "dance",
  "edm",
  "house",
  "electronic",
  "reggae",
  "country",
  "folk",
  "indie",
  "alternative",
  "metal",
  "hard rock",
  "punk",
  "blues",
  "jazz",
  "classical",
  "k-pop",
  "j-pop",
  "bossa nova",
  "mpb",
  "sertanejo",
  "afrobeats",
  "soundtrack",
  "children's music",
] as const;

/**
 * Spotify no expone el idioma de una canción. Lo aproximamos con el mercado (país)
 * de búsqueda y, opcionalmente, palabras clave. Para un filtro de idioma fiable
 * lo mejor es usar playlists propias como fuente. El nombre de cada idioma lo pone la pantalla
 * (`m.setup.musicLanguages`), en el idioma de quien la usa.
 */
export const LANGUAGES = [
  { id: "es", market: "ES" },
  { id: "es-latam", market: "MX" },
  { id: "en", market: "US" },
  { id: "pt", market: "BR" },
  { id: "fr", market: "FR" },
  { id: "it", market: "IT" },
  { id: "de", market: "DE" },
  { id: "ko", market: "KR" },
  { id: "ja", market: "JP" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export function marketForLanguage(id: string | undefined): string | undefined {
  return LANGUAGES.find((l) => l.id === id)?.market;
}

export const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;
