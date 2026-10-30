import "server-only";
import { db } from "@/lib/db";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** Ventanas que se pueden ver en el panel. */
export const STAT_WINDOWS = { "24h": DAY_MS, "7d": 7 * DAY_MS, "30d": 30 * DAY_MS } as const;
export type StatWindow = keyof typeof STAT_WINDOWS;
export const isStatWindow = (v: unknown): v is StatWindow => typeof v === "string" && v in STAT_WINDOWS;

/** Días que enseña la tabla de actividad. */
export const DAILY_DAYS = 14;
/** Una partida creada que lleva más que esto sin terminar cuenta como abandonada. */
export const ABANDONED_AFTER_MS = DAY_MS;

export interface Funnel {
  created: number;
  started: number;
  finished: number;
}

const rate = (part: number, whole: number) => (whole ? part / whole : null);
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Lo que se ve en «Cómo se usa» del panel: el embudo (invitados nuevos → partidas creadas → empezadas → terminadas),
 * su desglose por modo y formato, los móviles y la actividad de los últimos días. Todo sale de `GameEvent`, que no
 * guarda nada personal. Cada paso cuenta los eventos de la ventana (no sigue a la misma partida de un paso al otro).
 */
export async function getStats(window: StatWindow = "7d", now = new Date()) {
  const since = new Date(now.getTime() - STAT_WINDOWS[window]);
  const abandonedBefore = new Date(now.getTime() - ABANDONED_AFTER_MS);
  const dailySince = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (DAILY_DAYS - 1)));

  const [grouped, abandoned, daily] = await Promise.all([
    db.gameEvent.groupBy({
      by: ["type", "mode", "format", "replay"],
      where: { createdAt: { gte: since, lte: now } },
      _count: { _all: true },
    }),
    // Creadas en la ventana, de hace más de un día, y que nunca llegaron a terminar.
    db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "GameEvent" c
      WHERE c."type" = 'game_created' AND c."createdAt" >= ${since} AND c."createdAt" < ${abandonedBefore}
        AND NOT EXISTS (SELECT 1 FROM "GameEvent" f WHERE f."type" = 'game_finished' AND f."gameId" = c."gameId")`,
    db.$queryRaw<{ day: string; type: string; n: number }[]>`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, "type", count(*)::int AS n
      FROM "GameEvent"
      WHERE "createdAt" >= ${dailySince} AND "createdAt" <= ${now} AND "type" IN ('game_created', 'game_finished')
      GROUP BY 1, 2`,
  ]);

  const total = (type: string, pick?: (g: (typeof grouped)[number]) => boolean) =>
    grouped.filter((g) => g.type === type && (pick?.(g) ?? true)).reduce((n, g) => n + g._count._all, 0);
  const funnelOf = (pick: (g: (typeof grouped)[number]) => boolean): Funnel => ({
    created: total("game_created", pick),
    started: total("game_started", pick),
    finished: total("game_finished", pick),
  });
  const funnel = funnelOf(() => true);

  const days = Array.from({ length: DAILY_DAYS }, (_, i) => {
    const d = day(new Date(dailySince.getTime() + i * DAY_MS));
    const n = (type: string) => daily.find((r) => r.day === d && r.type === type)?.n ?? 0;
    return { day: d, created: n("game_created"), finished: n("game_finished") };
  });

  return {
    window,
    since,
    guests: total("guest_started"),
    funnel,
    rates: { started: rate(funnel.started, funnel.created), finished: rate(funnel.finished, funnel.started) },
    abandoned: abandoned[0]?.n ?? 0,
    byMode: { open: funnelOf((g) => g.mode === "open"), spotify: funnelOf((g) => g.mode === "spotify") },
    byFormat: { solo: funnelOf((g) => g.format === "solo"), teams: funnelOf((g) => g.format === "teams") },
    replays: total("game_created", (g) => g.replay),
    phones: { joined: total("phone_joined"), followed: total("phone_followed") },
    shared: total("result_shared"),
    reclaimed: total("seat_reclaimed"),
    daily: days,
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;
