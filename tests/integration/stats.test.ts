import { describe, expect, it } from "vitest";
import { runCleanup } from "@/lib/access/admin";
import { EVENT_KEEP_DAYS } from "@/lib/analytics/events";
import { getStats } from "@/lib/analytics/stats";
import { db } from "@/lib/db";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const now = new Date(Date.UTC(2026, 9, 28, 12));
const ago = (ms: number) => new Date(now.getTime() - ms);

type Row = { type: string; gameId?: string; mode?: string; format?: string; replay?: boolean; at: Date };
const add = (rows: Row[]) =>
  db.gameEvent.createMany({
    data: rows.map(({ at, ...r }) => ({ ownerKind: "guest", ...r, createdAt: at })),
  });

describe("estadísticas del panel", () => {
  it("cuenta el embudo, los porcentajes y el desglose de la ventana", async () => {
    await add([
      { type: "guest_started", at: ago(HOUR) },
      { type: "guest_started", at: ago(2 * HOUR) },
      // Tres partidas abiertas: una terminada, una empezada y una sin empezar.
      { type: "game_created", gameId: "a", mode: "open", format: "solo", at: ago(3 * HOUR) },
      { type: "game_started", gameId: "a", mode: "open", format: "solo", at: ago(3 * HOUR) },
      { type: "game_finished", gameId: "a", mode: "open", format: "solo", at: ago(2 * HOUR) },
      { type: "game_created", gameId: "b", mode: "open", format: "teams", at: ago(3 * HOUR) },
      { type: "game_started", gameId: "b", mode: "open", format: "teams", at: ago(3 * HOUR) },
      { type: "game_created", gameId: "c", mode: "spotify", format: "solo", at: ago(3 * HOUR) },
      // «Otra igual» de la primera, y dos móviles (uno siguió).
      { type: "game_created", gameId: "d", mode: "open", format: "solo", replay: true, at: ago(HOUR) },
      { type: "phone_joined", gameId: "a", at: ago(3 * HOUR) },
      { type: "phone_joined", gameId: "a", at: ago(3 * HOUR) },
      { type: "phone_followed", gameId: "d", at: ago(HOUR) },
      { type: "result_shared", gameId: "a", mode: "open", format: "solo", at: ago(2 * HOUR) },
      // Fuera de la ventana de 24 h.
      { type: "game_created", gameId: "z", mode: "open", format: "solo", at: ago(3 * DAY) },
    ]);

    const s = await getStats("24h", now);

    expect(s.guests).toBe(2);
    expect(s.funnel).toEqual({ created: 4, started: 2, finished: 1 });
    expect(s.rates).toEqual({ started: 0.5, finished: 0.5 });
    expect(s.replays).toBe(1);
    expect(s.phones).toEqual({ joined: 2, followed: 1 });
    expect(s.shared).toBe(1);
    expect(s.byMode.open).toEqual({ created: 3, started: 2, finished: 1 });
    expect(s.byMode.spotify).toEqual({ created: 1, started: 0, finished: 0 });
    expect(s.byFormat.teams).toEqual({ created: 1, started: 1, finished: 0 });

    // En 7 días entra también la de hace 3 días.
    expect((await getStats("7d", now)).funnel.created).toBe(5);
  });

  it("sin partidas no inventa porcentajes", async () => {
    const s = await getStats("7d", now);
    expect(s.funnel).toEqual({ created: 0, started: 0, finished: 0 });
    expect(s.rates).toEqual({ started: null, finished: null });
  });

  it("abandonada: creada hace más de un día y nunca terminada", async () => {
    await add([
      { type: "game_created", gameId: "vieja-sin-terminar", mode: "open", format: "solo", at: ago(2 * DAY) },
      { type: "game_created", gameId: "vieja-terminada", mode: "open", format: "solo", at: ago(2 * DAY) },
      { type: "game_finished", gameId: "vieja-terminada", mode: "open", format: "solo", at: ago(2 * DAY - HOUR) },
      // Reciente: todavía puede terminarla.
      { type: "game_created", gameId: "reciente", mode: "open", format: "solo", at: ago(HOUR) },
    ]);

    expect((await getStats("7d", now)).abandoned).toBe(1);
  });

  it("la actividad diaria trae 14 días, con ceros donde no pasó nada", async () => {
    await add([
      { type: "game_created", gameId: "x", mode: "open", format: "solo", at: ago(HOUR) },
      { type: "game_created", gameId: "y", mode: "open", format: "solo", at: ago(2 * HOUR) },
      { type: "game_finished", gameId: "x", mode: "open", format: "solo", at: ago(HOUR) },
      { type: "game_created", gameId: "w", mode: "open", format: "solo", at: ago(5 * DAY) },
    ]);

    const { daily } = await getStats("30d", now);

    expect(daily).toHaveLength(14);
    expect(daily.at(-1)).toEqual({ day: "2026-10-28", created: 2, finished: 1 });
    expect(daily.find((d) => d.day === "2026-10-23")).toMatchObject({ created: 1, finished: 0 });
    expect(daily.find((d) => d.day === "2026-10-25")).toEqual({ day: "2026-10-25", created: 0, finished: 0 });
  });

  it("la limpieza diaria borra los eventos de más de 400 días", async () => {
    await add([
      { type: "game_created", gameId: "antigua", at: ago((EVENT_KEEP_DAYS + 1) * DAY) },
      { type: "game_created", gameId: "reciente", at: ago(30 * DAY) },
    ]);

    const result = await runCleanup(now);

    expect(result.events).toBe(1);
    expect((await db.gameEvent.findMany()).map((e) => e.gameId)).toEqual(["reciente"]);
  });
});
