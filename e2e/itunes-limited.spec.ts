import { FAKE_RATE_LIMIT_KEYWORD } from "../src/lib/itunes/fake";
import { expect, test } from "./support/test";
import { guestToNewGame } from "./support/flows";

const LIMITED = /mucha gente jugando y iTunes pidió una pausa/;

// iTunes falso respondiendo 429 (como si hubiera un pico de visitas): la familia ve qué pasa y qué hacer,
// sin pantallas de error, y la partida sigue ahí para intentarlo de nuevo.
test("si iTunes nos limita, se avisa con claridad al probar filtros y al empezar la ronda", async ({ page }) => {
  await guestToNewGame(page);
  await page.getByRole("textbox", { name: "Jugador 1", exact: true }).fill("Ana");
  await page.getByRole("textbox", { name: "Palabra clave" }).fill(FAKE_RATE_LIMIT_KEYWORD);

  await page.getByRole("button", { name: /Probar filtros/ }).click();
  await expect(page.getByText(LIMITED).first()).toBeVisible();

  await page.getByRole("button", { name: "Grabar y empezar" }).click();
  await page.waitForURL("**/partida/*");
  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByText(LIMITED).first()).toBeVisible();
  // Sin pantalla de error: la partida sigue esperando y se puede volver a intentar.
  await expect(page.getByRole("heading", { name: /Se enredó/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Empezar/ })).toBeEnabled();
});
