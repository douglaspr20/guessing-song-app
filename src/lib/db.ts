import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * La CLI de Prisma resuelve `file:./dev.db` respecto a la carpeta `prisma/`, pero el
 * cliente empaquetado por Next no. Convertimos la ruta en absoluta para que ambos
 * apunten al mismo archivo.
 */
function resolveDatabaseUrl(url = process.env.DATABASE_URL ?? "file:./dev.db") {
  if (!url.startsWith("file:")) return url;
  const file = url.slice("file:".length);
  if (path.isAbsolute(file)) return url;
  return `file:${path.join(process.cwd(), "prisma", file)}`;
}

// Reutiliza la misma instancia entre recargas en desarrollo.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: resolveDatabaseUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
