import { describe, expect, it } from "vitest";
import { describeGuess } from "@/app/game/[id]/_lib/feedback";
import { deriveRoundClock, type RoundClockInput } from "@/app/game/[id]/_lib/roundClock";
import type { GuessResult, Round } from "@/lib/client/api";
import { OPEN_RULES, SPOTIFY_RULES } from "@/lib/game/scoring";

const round = (patch: Partial<Round> = {}): Round =>
  ({
    id: "r1",
    number: 1,
    status: "PLAYING",
    startMs: 60_000,
    fragmentMs: 60_000,
    playStartedAt: new Date("2026-10-18T12:00:00Z"),
    paused: false,
    elapsedMs: 10_000,
    pointsNow: 3,
    artistAvailable: true,
    hints: [],
    nextHintAt: null,
    winnerPlayerId: null,
    artistWinnerPlayerId: null,
    answer: null,
    ...patch,
  }) as Round;

const input = (patch: Partial<RoundClockInput> = {}): RoundClockInput => ({
  round: round(),
  fragmentSeconds: 60,
  rules: SPOTIFY_RULES,
  fetchedAt: 1_000_000,
  now: 1_000_000,
  player: { phase: "playing", remainingMs: 50_000, fragmentMs: 60_000 },
  ...patch,
});

describe("deriveRoundClock", () => {
  it("suma al tiempo del servidor lo que pasó desde que se leyó", () => {
    const c = deriveRoundClock(input({ now: 1_012_000 }));
    expect(c.elapsedMs).toBe(22_000);
    expect(c.pointsNow).toBe(2);
    expect(c.nextDropInMs).toBe(18_000);
    expect(c.artistOpen).toBe(true);
  });

  it("no avanza el reloj si la ronda está en pausa", () => {
    const c = deriveRoundClock(input({ round: round({ paused: true }), now: 1_030_000 }));
    expect(c.elapsedMs).toBe(10_000);
  });

  it("muestra la cuenta atrás y la cinta del reproductor mientras suena", () => {
    const c = deriveRoundClock(input());
    expect(c.orphan).toBe(false);
    expect(c.shownLeftMs).toBe(50_000);
    expect(c.tapeProgress).toBeCloseTo(1 / 6);
    expect(c.caption).toBe("quedan para adivinar");
  });

  it("tras recargar (sin audio) congela el reloj y ofrece seguir donde se quedó", () => {
    const c = deriveRoundClock(input({ player: { phase: "idle", remainingMs: 0, fragmentMs: 0 } }));
    expect(c.orphan).toBe(true);
    expect(c.orphanLeftMs).toBe(50_000);
    expect(c.needsFreeze).toBe(true);
    expect(c.canResume).toBe(true);
    expect(c.caption).toBe("en pausa · pulsa Seguir");
    // Con un turno abierto, «Seguir» está apagado: el casete dice quién responde.
    const turn = deriveRoundClock(
      input({
        round: round({
          paused: true,
          buzz: { participantId: "p1", name: "Ana", playerId: "pl1", remainingMs: 9_000, totalMs: 20_000 },
        }),
        player: { phase: "paused", remainingMs: 20_000, fragmentMs: 30_000 },
      }),
    );
    expect(turn.caption).toBe("responde Ana");
  });

  it("mientras arranca el audio (el servidor ya cuenta) no se toma por recarga: no congela ni ofrece seguir", () => {
    // Pasaba al llegar el aviso «round_playing» antes de que cargara el audio: la ronda se quedaba en pausa
    // en el servidor con la música sonando, y nadie podía pulsar «¡Lo sé!».
    const c = deriveRoundClock(input({ round: round({ elapsedMs: 300 }), player: { phase: "starting", remainingMs: 0, fragmentMs: 0 } }));
    expect(c.needsFreeze).toBe(false);
    expect(c.canResume).toBe(false);
    expect(c.shownLeftMs).toBe(59_700);
  });

  it("ya pausada tras recargar no vuelve a pedir la pausa", () => {
    const c = deriveRoundClock(
      input({ round: round({ paused: true }), player: { phase: "idle", remainingMs: 0, fragmentMs: 0 } }),
    );
    expect(c.needsFreeze).toBe(false);
    expect(c.canResume).toBe(true);
  });

  it("si la cinta ya terminó no ofrece seguir", () => {
    const c = deriveRoundClock(
      input({ round: round({ elapsedMs: 70_000 }), player: { phase: "idle", remainingMs: 0, fragmentMs: 0 } }),
    );
    expect(c.orphanLeftMs).toBe(0);
    expect(c.canResume).toBe(false);
    expect(c.caption).toBe("se acabó la cinta");
  });

  it("con las reglas del modo abierto los tramos son de 10 s", () => {
    const c = deriveRoundClock(
      input({ rules: OPEN_RULES, fragmentSeconds: 30, round: round({ elapsedMs: 12_000 }), player: { phase: "playing", remainingMs: 18_000, fragmentMs: 30_000 } }),
    );
    expect(c.pointsNow).toBe(2);
    expect(c.nextDropInMs).toBe(8_000);
    expect(c.artistOpen).toBe(true);
    const late = deriveRoundClock(input({ rules: OPEN_RULES, fragmentSeconds: 30, round: round({ elapsedMs: 21_000 }) }));
    expect(late.pointsNow).toBe(1);
    expect(late.nextDropInMs).toBeNull();
    expect(late.artistOpen).toBe(false);
  });

  it("antes de sonar indica que aún no ha sonado", () => {
    const c = deriveRoundClock(input({ round: round({ playStartedAt: null, elapsedMs: 0 }) }));
    expect(c.started).toBe(false);
    expect(c.caption).toBe("aún no ha sonado");
  });
});

describe("describeGuess", () => {
  const result = (patch: Partial<GuessResult>): GuessResult =>
    ({ titleCorrect: false, artistCorrect: false, titleAwarded: false, artistAwarded: false, points: 0, ...patch }) as GuessResult;

  it("celebra título y artista con los puntos", () => {
    const f = describeGuess("Ana", result({ titleCorrect: true, titleAwarded: true, artistCorrect: true, artistAwarded: true, points: 4 }), {
      title: true,
      artist: true,
    });
    expect(f).toEqual({ tone: "good", text: "Ana: ¡acertó la canción y el artista! +4" });
  });

  it("explica un fallo sin puntos", () => {
    expect(describeGuess("Luis", result({}), { title: true, artist: false })).toEqual({
      tone: "bad",
      text: "Luis: no es esa canción",
    });
  });
});
