import type { GuessResult } from "@/lib/client/api";
import type { LiveEvent } from "@/lib/client/live";

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

/** Cómo acabó el turno de quien pulsó «¡Lo sé!» desde el móvil (null si no hay nada que decir). */
export function buzzFeedback(e: LiveEvent): Feedback | null {
  const name = typeof e.name === "string" && e.name ? e.name : "Alguien";
  switch (e.outcome) {
    case "correct":
      return { tone: "good", text: `${name}: ¡acertó la canción!` };
    case "wrong":
      return { tone: "bad", text: `${name} falló y queda fuera de esta pista` };
    case "timeout":
      return { tone: "bad", text: `${name} se quedó sin tiempo y queda fuera de esta pista` };
    default:
      return null;
  }
}

export function acceptedFeedback(name: string, points: number): Feedback {
  return { tone: "good", text: `Dado por bueno: ${name} suma ${points}` };
}
