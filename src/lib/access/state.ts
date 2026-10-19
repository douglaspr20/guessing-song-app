import "server-only";
import { db } from "@/lib/db";

/** Fila única con los interruptores del anfitrión. Se crea la primera vez que se pide. */
export function getAppState() {
  return db.appState.upsert({ where: { id: "app" }, create: { id: "app" }, update: {} });
}

export async function setAppFlags(flags: { openModePaused?: boolean; guestSignupsPaused?: boolean }) {
  await getAppState();
  return db.appState.update({ where: { id: "app" }, data: flags });
}
