import type { Feedback } from "../_lib/feedback";
import styles from "../game.module.css";

/** Resultado de la última respuesta, en verde si sumó y en rojo si no. */
export function FeedbackLine({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  return (
    <p
      className={`${styles.feedback} ${feedback.tone === "good" ? styles.feedbackGood : styles.feedbackBad}`}
      role="status"
    >
      {feedback.text}
    </p>
  );
}
