import { expect, phoneContext, test } from "./support/test";
import { lastGameCode } from "./support/db";
import { createSoloGame } from "./support/flows";

test("las pistas también salen en el móvil, a la vez que en la tele", async ({ page, browser, baseURL }) => {
  // La primera pista (palabras) sale a los 10 s en el modo abierto.
  test.setTimeout(90_000);
  await createSoloGame(page, ["Ana", "Luis"], 2);
  const code = await lastGameCode();

  const phone = await phoneContext(browser, baseURL);
  const mobile = await phone.newPage();
  await mobile.goto("/join");
  await mobile.getByLabel("Código de la partida").fill(code);
  await mobile.getByRole("button", { name: "Continuar" }).click();
  await mobile.getByLabel("Tu nombre").fill("Pablo");
  await mobile.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(mobile.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();
  await expect(mobile.getByRole("list", { name: "Pistas" })).toHaveCount(0);

  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();

  // En cuanto suena, el móvil enseña las tres marcas, aún sin desvelar.
  const hints = mobile.getByRole("list", { name: "Pistas" });
  await expect(hints).toBeVisible({ timeout: 15_000 });
  await expect(hints.getByRole("listitem")).toHaveCount(3);
  await expect(hints.getByRole("listitem").first()).toContainText("—");

  // A los 10 s llega «N palabras» sin recargar: el móvil la pide justo cuando toca.
  await expect(hints.getByRole("listitem").first()).toContainText(/\d+ palabras?/, { timeout: 20_000 });
  await phone.close();
});
