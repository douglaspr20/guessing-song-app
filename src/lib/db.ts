import { PrismaClient } from "@/generated/prisma/client";

// Reutiliza la misma instancia entre recargas en desarrollo.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
