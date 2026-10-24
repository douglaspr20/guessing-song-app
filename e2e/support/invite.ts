import { createHash, randomUUID } from "node:crypto";
import { pool } from "./db";

/** Crea una invitación válida directamente en la base y devuelve el código tal como lo vería quien la recibe. */
export async function createInvite(raw = "ABCDEFGHJKMN") {
  await pool.query(`INSERT INTO "Invite" (id, "codeHash", "expiresAt") VALUES ($1, $2, $3)`, [
    randomUUID(),
    createHash("sha256").update(raw).digest("hex"),
    new Date(Date.now() + 7 * 86_400_000),
  ]);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
