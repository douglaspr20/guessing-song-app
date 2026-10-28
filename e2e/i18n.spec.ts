import { expect, phoneContext, test } from "./support/test";
import { lastGameCode } from "./support/db";
import { createSoloGame } from "./support/flows";

test.describe("con el navegador en inglés", () => {
  test.use({ locale: "en-US" });

  test("la portada sale en inglés y el selector cambia a español (y se recuerda)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play without an account" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "Español" }).click();
    await expect(page.getByRole("button", { name: "Jugar sin cuenta" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    // La cookie manda sobre el idioma del navegador.
    await page.reload();
    await expect(page.getByRole("button", { name: "Jugar sin cuenta" })).toBeVisible();
  });

  test("los errores de la API llegan en inglés", async ({ page }) => {
    await page.goto("/join");
    await page.getByLabel("Game code").fill("ZZZZZZ");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("There's no game with that code")).toBeVisible();
  });
});

test("la tele en español y un móvil en inglés juegan la misma partida", async ({ page, browser, baseURL }) => {
  await createSoloGame(page, ["Ana", "Luis"], 2);
  const code = await lastGameCode();

  const phone = await phoneContext(browser, baseURL, "en-US");
  const mobile = await phone.newPage();
  await mobile.goto(`/join/${code}`);
  await mobile.getByRole("textbox", { name: "Your name" }).fill("Pablo");
  await mobile.getByRole("button", { name: "Join", exact: true }).click();
  await expect(mobile.getByRole("heading", { name: "Waiting for it to start" })).toBeVisible();

  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  await expect(mobile.getByRole("button", { name: "I know it!" })).toBeEnabled({ timeout: 15_000 });
  await phone.close();
});
