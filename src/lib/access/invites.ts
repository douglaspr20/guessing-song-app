import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { sha256 } from "./hash";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I
export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

/** Mayúsculas y sin guiones ni espacios: «abcd-efgh-jkmn» y «ABCDEFGHJKMN» son el mismo código. */
export function normalizeInviteCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Crea una invitación. El código solo se devuelve aquí: en la base de datos queda su hash. */
export async function createInvite(note: string | null, now = new Date()) {
  const raw = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const invite = await db.invite.create({
    data: { codeHash: sha256(raw), note, expiresAt: new Date(now.getTime() + INVITE_TTL_MS) },
  });
  return { id: invite.id, code: raw.match(/.{4}/g)!.join("-"), note, expiresAt: invite.expiresAt };
}

export async function listInvites() {
  const invites = await db.invite.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { usedBy: { select: { username: true } } },
  });
  return invites.map((i) => ({
    id: i.id,
    note: i.note,
    createdAt: i.createdAt,
    expiresAt: i.expiresAt,
    usedAt: i.usedAt,
    usedBy: i.usedBy?.username ?? null,
  }));
}

/** Anula una invitación que aún no se usó. */
export async function revokeInvite(id: string) {
  await db.invite.deleteMany({ where: { id, usedAt: null } });
}
