import { expect, test } from "./support/test";
import { playingRound } from "./support/db";
import { createSoloGame, guestToNewGame } from "./support/flows";

test("el anfitrión también juega: lo elige al grabar, pulsa «¡Lo sé!» en su pantalla y lo juzga el servidor", async ({ page }) => {
  await guestToNewGame(page);
  await page.getByRole("textbox", { name: "Jugador 1", exact: true }).fill("Ana");
  await page.getByRole("textbox", { name: "Jugador 2", exact: true }).fill("Luis");
  await page.getByRole("checkbox", { name: "Yo también juego" }).check();
  // Sin elegir nombre no se puede grabar.
  await expect(page.getByText("Elige con qué nombre juegas tú.")).toBeVisible();
  await page.getByRole("group", { name: "Juego como" }).getByRole("button", { name: "Ana" }).click();
  await page.getByRole("button", { name: "Grabar y empezar" }).click();
  await page.waitForURL("**/game/*");

  // En la sala ya sale con qué nombre juega, y en la lista de dentro figura como anfitrión.
  await expect(page.getByRole("heading", { name: "Juegas como Ana" })).toBeVisible();
  await expect(page.getByText("anfitrión", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^Empezar/ }).click();
  const pad = page.getByRole("region", { name: "Tu pulsador: juegas como Ana" });
  const buzz = pad.getByRole("button", { name: "¡Lo sé!" });
  await expect(buzz).toBeEnabled({ timeout: 15_000 });
  await buzz.click();

  // Su turno: su formulario, sin «Lo dijo bien» (no puede darse los puntos a sí mismo).
  const form = page.getByRole("form", { name: "Tu respuesta" });
  await expect(form).toBeVisible();
  await expect(page.getByRole("button", { name: "Lo dijo bien" })).toHaveCount(0);
  const round = await playingRound();
  await form.getByLabel("Canción").fill(round.trackName);
  await form.getByRole("button", { name: "Enviar respuesta" }).click();

  await expect(page.getByText(`Era ${round.trackName}`)).toBeVisible({ timeout: 15_000 });
});

test("en la sala, antes de empezar, el anfitrión puede apuntarse, cambiar de nombre y dejarlo", async ({ page }) => {
  await createSoloGame(page, ["Ana", "Luis"], 2);
  await expect(page.getByRole("heading", { name: "¿Juegas tú también?" })).toBeVisible();
  const names = page.getByRole("group", { name: "Toca tu nombre" });

  await names.getByRole("button", { name: "Luis" }).click();
  await expect(page.getByRole("heading", { name: "Juegas como Luis" })).toBeVisible();
  await names.getByRole("button", { name: "Ana" }).click();
  await expect(page.getByRole("heading", { name: "Juegas como Ana" })).toBeVisible();

  await page.getByRole("button", { name: "No juego" }).click();
  await expect(page.getByRole("heading", { name: "¿Juegas tú también?" })).toBeVisible();
});
