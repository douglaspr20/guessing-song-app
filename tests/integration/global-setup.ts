import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../../src/generated/prisma/client";

/** Crea la base de datos de tests si no existe y le aplica las migraciones. */
export default async function setup() {
  const testUrl = process.env.TEST_DATABASE_URL ?? "postgresql://adivina:adivina@localhost:5432/adivina_test";
  const url = new URL(testUrl);
  const dbName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error(`Nombre de base de datos de tests raro: ${dbName}`);

  // Conecta a la base de datos "postgres" del mismo servidor para crear la de tests.
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
  try {
    const rows = await admin.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
    if (rows.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: testUrl, DATABASE_URL_UNPOOLED: testUrl };
  // En Windows la CLI de Prisma a veces no encuentra su motor de esquemas.
  const engine = path.resolve("node_modules/@prisma/engines/schema-engine-windows.exe");
  if (process.platform === "win32" && existsSync(engine)) env.PRISMA_SCHEMA_ENGINE_BINARY ??= engine;
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
}
