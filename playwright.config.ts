import { defineConfig, devices } from "@playwright/test";
import { E2E_ENV, E2E_PORT } from "./e2e/support/env";

/**
 * Pruebas de navegador de los flujos principales. Corren contra la app ya compilada (`next start`)
 * con una base de datos propia (`adivina_e2e`), sin Ably, Spotify, Google ni iTunes.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Una sola base compartida y límites de intentos por IP: los tests van de uno en uno.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${E2E_PORT}`,
    // La portada es estática: responde aunque la base de pruebas aún no exista (la crea globalSetup, que corre después).
    url: `http://localhost:${E2E_PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: E2E_ENV,
  },
});
