import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests de integración contra Postgres (base de datos adivina_test): `npm run test:integration`.
// Necesitan el contenedor en marcha (`npm run db:up`); en CI, el servicio de Postgres.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://adivina:adivina@localhost:5432/adivina_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lanza fuera de Next: en los tests es un módulo vacío.
      "server-only": fileURLToPath(new URL("./tests/integration/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    env: { DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL, TEST_DATABASE_URL },
    // Comparten la base de datos: un archivo detrás de otro.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
