/** Similitud mínima (0..1) para dar por buena una respuesta con erratas. */
export const SIMILARITY_THRESHOLD = 0.8;
/** Títulos tan cortos que solo se aceptan escritos exactamente. */
const SHORT_TITLE_LENGTH = 4;
/** Fracción mínima del título que debe cubrir una respuesta parcial ("bohemian rhapsody" ⊂ título largo). */
const MIN_PARTIAL_COVERAGE = 0.7;

const LEADING_ARTICLES = /^(the|a|an|el|la|los|las|un|una|le|les|il|lo|der|die|das|o|os|as)\s+/;

/** Minúsculas, sin tildes, sin puntuación y con espacios colapsados. */
export function basicNormalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quita "(feat. X)", "[Live]", "- Remastered 2011" y colaboraciones, sin tocar mayúsculas ni tildes. */
export function stripTitleExtras(title: string): string {
  return (
    title
      .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
      .split(/\s[-–—]\s/)[0]
      // Colaboraciones sin paréntesis: "Bailando feat Descemer Bueno".
      .replace(/\s(feat\.?|ft\.?|featuring)\s.*$/i, "")
      .trim()
  );
}

/**
 * Título "canónico": quita lo que va entre paréntesis/corchetes ("(feat. X)", "[Live]")
 * y todo lo que sigue a " - " ("- Remastered 2011", "- Remix"), además del artículo inicial.
 */
export function canonicalTitle(title: string): string {
  const normalized = basicNormalize(stripTitleExtras(title)).replace(LEADING_ARTICLES, "");
  // Si al limpiar no queda nada (título raro), usa el título completo normalizado.
  return normalized || basicNormalize(title);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** 1 = idénticos, 0 = nada que ver. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

function matches(guess: string, title: string): boolean {
  if (!guess || !title) return false;
  if (guess === title) return true;
  if (title.length <= SHORT_TITLE_LENGTH) return false;

  // Ignorar espacios ayuda con "rock and roll" vs "rockandroll".
  const g = guess.replace(/\s/g, "");
  const t = title.replace(/\s/g, "");
  if (g === t) return true;

  if (t.includes(g) && g.length / t.length >= MIN_PARTIAL_COVERAGE) return true;
  return similarity(g, t) >= SIMILARITY_THRESHOLD;
}

/** ¿La respuesta escrita corresponde al título de la pista? */
export function isCorrectGuess(guess: string, trackName: string): boolean {
  const guessCanonical = canonicalTitle(guess);
  const titleCanonical = canonicalTitle(trackName);
  return (
    matches(guessCanonical, titleCanonical) ||
    // Por si el jugador escribe el título completo con su "- Remastered" o "(feat. ...)".
    matches(basicNormalize(guess), basicNormalize(trackName))
  );
}

function canonicalArtist(name: string): string {
  return basicNormalize(name).replace(LEADING_ARTICLES, "");
}

/** Palabras que no identifican a un artista por sí solas ("Los", "Band", "Orquesta"...). */
const GENERIC_ARTIST_WORDS = new Set([
  "the", "and", "los", "las", "del", "les", "die", "der", "y", "de", "la", "el",
  "band", "banda", "orquesta", "orchestra", "grupo", "group", "conjunto", "feat",
  "boys", "girls", "brothers", "hermanos", "family", "familia", "club", "gang",
  "music", "sound", "project", "trio", "quartet", "dj", "mc",
]);
/** Una palabra suelta solo cuenta si es lo bastante larga para no acertar por casualidad. */
const MIN_ARTIST_WORD = 4;

/** ¿La respuesta es una palabra distintiva del nombre? ("soda" para "Soda Stereo", "lavoe" para "Héctor Lavoe"). */
function matchesArtistWord(guess: string, artist: string): boolean {
  const g = basicNormalize(guess).replace(/\s/g, "");
  if (g.length < MIN_ARTIST_WORD) return false;
  return basicNormalize(artist)
    .split(" ")
    .filter((w) => w.length >= MIN_ARTIST_WORD && !GENERIC_ARTIST_WORDS.has(w))
    .some((w) => w === g || (g.length >= 5 && similarity(g, w) >= SIMILARITY_THRESHOLD));
}

/** ¿La respuesta corresponde a alguno de los artistas de la pista? ("beatles" vale para "The Beatles"). */
export function isCorrectArtist(guess: string, artists: string[]): boolean {
  const g = canonicalArtist(guess);
  return artists.some(
    (a) =>
      matches(g, canonicalArtist(a)) ||
      matches(basicNormalize(guess), basicNormalize(a)) ||
      matchesArtistWord(guess, a),
  );
}
