import { connection } from "next/server";
import { requireHost } from "@/lib/access/session";
import { getStats, isStatWindow } from "@/lib/analytics/stats";
import { handle } from "@/lib/errors";

/** «Cómo se usa» del panel: el embudo y la actividad, de la última 24 h, 7 días o 30 días. */
export const GET = handle(async (req: Request) => {
  await connection();
  await requireHost();
  const window = new URL(req.url).searchParams.get("window");
  return Response.json(await getStats(isStatWindow(window) ? window : "7d"));
});
