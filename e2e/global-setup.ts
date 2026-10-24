import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "./support/env";

/** Crea la base de datos de las pruebas e2e si no existe y le aplica las migraciones. */
export default async function globalSetup() {
  const dbName = new URL(E2E_DATABASE_URL).pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error(`Nombre de base de datos e2e raro: ${dbName}`);

  const adminUrl = new URL(E2E_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: E2E_DATABASE_URL,
    DATABASE_URL_UNPOOLED: E2E_DATABASE_URL,
  };
  // En Windows la CLI de Prisma a veces no encuentra su motor de esquemas.
  const engine = path.resolve("node_modules/@prisma/engines/schema-engine-windows.exe");
  if (process.platform === "win32" && existsSync(engine)) env.PRISMA_SCHEMA_ENGINE_BINARY ??= engine;
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
}
