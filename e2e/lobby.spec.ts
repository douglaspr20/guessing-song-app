import { expect, phoneContext, test } from "./support/test";
import { lastGameCode } from "./support/db";
import { createSoloGame } from "./support/flows";

test("en la sala, un móvil se sale de la partida y la tele lo quita y avisa", async ({ page, browser, baseURL }) => {
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
  // La tele ve a Pablo en la sala (llega por el sondeo de 3 s: Ably no está en las pruebas).
  await expect(page.getByRole("button", { name: "Sacar a Pablo" })).toBeVisible({ timeout: 15_000 });

  await mobile.getByRole("button", { name: "Salir de la partida" }).click();
  await mobile.getByRole("button", { name: "Salir", exact: true }).click();
  await mobile.waitForURL((url) => url.pathname === "/");

  await expect(page.getByText("Pablo se ha salido")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Sacar a Pablo" })).toHaveCount(0);
  await phone.close();
});

test("desde «¿Cómo te llamas?» se vuelve al inicio", async ({ page }) => {
  await createSoloGame(page, ["Ana", "Luis"], 1);
  const code = await lastGameCode();

  await page.goto("/join");
  await page.getByLabel("Código de la partida").fill(code);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "¿Cómo te llamas?" })).toBeVisible();

  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: "Tu estantería" })).toBeVisible();
});
