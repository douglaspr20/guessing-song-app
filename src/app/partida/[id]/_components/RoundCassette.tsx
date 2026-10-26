"use client";

import { Cassette, type HintMark } from "@/components/Cassette";
import type { Round } from "@/lib/client/api";
import type { RoundRules } from "@/lib/game/scoring";
import { plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import { hintSlots } from "../_lib/constants";
import type { RoundClockView } from "../_lib/roundClock";

/** El casete de la ronda abierta: lo que vale, el contador-cinta y las pistas desbloqueadas. */
export function RoundCassette({
  round,
  clock,
  rules,
  running,
}: {
  round: Round;
  clock: RoundClockView;
  rules: RoundRules;
  running: boolean;
}) {
  const { m, locale } = useI18n();
  const g = m.game;
  const hints: HintMark[] = hintSlots(rules, g.hintLabels).map((slot) => {
    const got = round.hints.find((h) => h.type === slot.key);
    // La pista de palabras llega como número: se redacta aquí, en el idioma de la pantalla.
    const value = got?.type === "words" && got.value ? plural(locale, Number(got.value), g.wordCount) : (got?.value ?? null);
    return { ...slot, value, unlocked: !!got };
  });

  return (
    <Cassette
      title={g.cassetteTitle(round.number)}
      value={clock.started ? <PointsLabel round={round} clock={clock} /> : g.pressPlay}
      remainingMs={clock.started ? clock.shownLeftMs : clock.fragmentMs}
      progress={clock.tapeProgress}
      running={running}
      caption={clock.caption}
      hints={hints}
    />
  );
}

function PointsLabel({ round, clock }: { round: Round; clock: RoundClockView }) {
  const { m } = useI18n();
  const g = m.game;
  const dropsIn = clock.nextDropInMs !== null && !round.paused ? g.dropsIn(Math.ceil(clock.nextDropInMs / 1000)) : "";
  return (
    <>
      {g.titleWorth}{" "}
      <b>
        {clock.pointsNow} {m.common.pts}
      </b>
      {dropsIn}
      {clock.artistOpen ? g.artistPlusOne : ""}
    </>
  );
}
