import type { GuessResult } from "@/lib/client/api";

/** Mensaje que ve la sala tras registrar una respuesta. */
export interface Feedback {
  tone: "good" | "bad";
  text: string;
}

/** Resume en una frase qué acertó (o no) el jugador y cuánto sumó. */
export function describeGuess(name: string, result: GuessResult, said: { title: boolean; artist: boolean }): Feedback {
  const parts: string[] = [];
  if (result.titleAwarded) parts.push("¡acertó la canción");
  else if (result.titleCorrect) parts.push("acertó la canción, pero alguien fue más rápido");
  else if (said.title) parts.push("no es esa canción");

  if (result.artistAwarded) parts.push(parts.length ? "y el artista" : "¡acertó el artista");
  else if (result.artistCorrect) parts.push("el artista es correcto, pero ya no suma");
  else if (said.artist) parts.push(parts.length ? "y el artista tampoco" : "no es ese artista");

  const text = `${name}: ${parts.join(" ")}${result.points ? `! +${result.points}` : ""}`;
  return { tone: result.points ? "good" : "bad", text };
}

/** El anfitrión le dio la canción o el artista a quien lo dijo en voz alta. */
export function spokenFeedback(name: string, part: "title" | "artist", points: number): Feedback {
  return { tone: "good", text: `${name}: ¡acertó ${part === "title" ? "la canción" : "el artista"}! +${points}` };
}

export function acceptedFeedback(name: string, points: number): Feedback {
  return { tone: "good", text: `Dado por bueno: ${name} suma ${points}` };
}
