import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Cliente de Prisma sobre el driver `pg` (sin motor nativo: funciona igual en local y en Vercel). */
export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("Falta DATABASE_URL");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reutiliza la misma instancia entre recargas en desarrollo.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
