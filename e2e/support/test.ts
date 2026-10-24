import { test as base, type Browser, type BrowserContext, devices } from "@playwright/test";
import { stubPreviews } from "./audio";
import { resetDb } from "./db";

/** `test` con la base limpia en cada prueba y las vistas previas de audio simuladas. */
export const test = base.extend<{ cleanDb: void }>({
  cleanDb: [
    async ({}, use) => {
      await resetDb();
      await use();
    },
    { auto: true },
  ],
  context: async ({ context }, use) => {
    await stubPreviews(context);
    await use(context);
  },
});

export { expect } from "@playwright/test";

/** Otro navegador con forma de móvil (la persona que se une con el código). */
export async function phoneContext(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  await stubPreviews(context);
  return context;
}
