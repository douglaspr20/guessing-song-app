import { expect, phoneContext, test } from "./support/test";
import { lastGameCode, playingRound } from "./support/db";
import { createSoloGame } from "./support/flows";

test("alguien se une desde el móvil con el código, pulsa «¡Lo sé!» y acierta", async ({ page, browser, baseURL }) => {
  // El anfitrión graba la partida; en su pantalla aparece el código para unirse.
  await createSoloGame(page, ["Ana", "Luis"], 2);
  const code = await lastGameCode();
  await expect(page.getByLabel(`Código ${code.split("").join(" ")}`)).toBeVisible();

  // En el móvil: código, nombre y dentro.
  const phone = await phoneContext(browser, baseURL);
  const mobile = await phone.newPage();
  await mobile.goto("/join");
  await mobile.getByLabel("Código de la partida").fill(code);
  await mobile.getByRole("button", { name: "Continuar" }).click();
  await mobile.getByLabel("Tu nombre").fill("Pablo");
  await mobile.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(mobile.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();

  // El anfitrión ve a Pablo en la sala (llega por el sondeo de 3 s: Ably no está en las pruebas).
  await expect(page.getByText("Pablo").first()).toBeVisible({ timeout: 15_000 });

  // Empieza la ronda: el móvil pasa a mostrar «¡Lo sé!».
  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  const buzz = mobile.getByRole("button", { name: "¡Lo sé!" });
  await expect(buzz).toBeEnabled({ timeout: 15_000 });
  await buzz.click();

  // La tele muestra quién tiene el turno; el móvil responde con el título.
  await expect(page.getByRole("region", { name: "Turno de respuesta" })).toContainText("Pablo", { timeout: 15_000 });
  const round = await playingRound();
  // La ronda guarda de qué búsqueda salió la canción.
  expect(round.pickedVia).toMatch(/^itunes: .+ \([A-Z]{2}\)$/);
  await mobile.getByLabel("Canción").fill(round.trackName);
  await mobile.getByRole("button", { name: "Enviar respuesta" }).click();

  await expect(page.getByText(`Era ${round.trackName}`)).toBeVisible({ timeout: 15_000 });
  await phone.close();
});
