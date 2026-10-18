import { Cassette, type HintMark } from "@/components/Cassette";
import type { Round } from "@/lib/client/api";
import { HINT_SLOTS } from "../_lib/constants";
import type { RoundClockView } from "../_lib/roundClock";

/** El casete de la ronda abierta: lo que vale, el contador-cinta y las pistas desbloqueadas. */
export function RoundCassette({
  round,
  clock,
  running,
}: {
  round: Round;
  clock: RoundClockView;
  running: boolean;
}) {
  const hints: HintMark[] = HINT_SLOTS.map((slot) => {
    const got = round.hints.find((h) => h.type === slot.key);
    return { ...slot, value: got?.value ?? null, unlocked: !!got };
  });

  return (
    <Cassette
      title={`Pista ${round.number} — ¿Qué canción es?`}
      value={clock.started ? <PointsLabel round={round} clock={clock} /> : "Pulsa reproducir"}
      remainingMs={clock.started ? clock.shownLeftMs : clock.fragmentMs}
      progress={clock.tapeProgress}
      running={running}
      caption={clock.caption}
      hints={hints}
    />
  );
}

function PointsLabel({ round, clock }: { round: Round; clock: RoundClockView }) {
  const dropsIn = clock.nextDropInMs !== null && !round.paused ? ` · baja en ${Math.ceil(clock.nextDropInMs / 1000)} s` : "";
  return (
    <>
      Título <b>{clock.pointsNow} pts</b>
      {dropsIn}
      {clock.artistOpen ? " · artista +1" : ""}
    </>
  );
}
