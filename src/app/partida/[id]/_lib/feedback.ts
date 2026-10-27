import { game as esGame } from "@/i18n/messages/es/game";
import type { GuessResult } from "@/lib/client/api";
import type { LiveEvent } from "@/lib/client/live";

/** Mensaje que ve la sala tras registrar una respuesta. */
export interface Feedback {
  tone: "good" | "bad";
  text: string;
}

/** Frases de cada idioma (`m.game.feedback`); por defecto, en español. */
type FeedbackText = typeof esGame.feedback;

/** Resume en una frase qué acertó (o no) el jugador y cuánto sumó. */
export function describeGuess(
  name: string,
  result: GuessResult,
  said: { title: boolean; artist: boolean },
  t: FeedbackText = esGame.feedback,
): Feedback {
  const parts: string[] = [];
  if (result.titleAwarded) parts.push(t.titleAwarded);
  else if (result.titleCorrect) parts.push(t.titleLate);
  else if (said.title) parts.push(t.titleWrong);

  if (result.artistAwarded) parts.push(parts.length ? t.artistAwardedAnd : t.artistAwarded);
  else if (result.artistCorrect) parts.push(t.artistLate);
  else if (said.artist) parts.push(parts.length ? t.artistWrongToo : t.artistWrong);

  const text = `${name}: ${parts.join(" ")}${result.points ? t.points(result.points) : ""}`;
  return { tone: result.points ? "good" : "bad", text };
}

/** El anfitrión le dio la canción o el artista a quien lo dijo en voz alta. */
export function spokenFeedback(
  name: string,
  part: "title" | "artist",
  points: number,
  t: FeedbackText = esGame.feedback,
): Feedback {
  return { tone: "good", text: part === "title" ? t.spokenTitle(name, points) : t.spokenArtist(name, points) };
}

/** Cómo acabó el turno de quien pulsó «¡Lo sé!» desde el móvil (null si no hay nada que decir). */
export function buzzFeedback(e: LiveEvent, t: FeedbackText = esGame.feedback): Feedback | null {
  const name = typeof e.name === "string" && e.name ? e.name : t.someone;
  switch (e.outcome) {
    case "correct":
      return { tone: "good", text: t.buzzCorrect(name) };
    case "wrong":
      return { tone: "bad", text: t.buzzWrong(name) };
    case "timeout":
      return { tone: "bad", text: t.buzzTimeout(name) };
    default:
      return null;
  }
}

export function acceptedFeedback(name: string, points: number, t: FeedbackText = esGame.feedback): Feedback {
  return { tone: "good", text: t.accepted(name, points) };
}
