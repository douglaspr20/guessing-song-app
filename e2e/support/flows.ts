import { expect, type Page } from "@playwright/test";

/** Entra «sin cuenta» (invitado) y llega a la pantalla de nueva partida en modo abierto. */
export async function guestToNewGame(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Jugar sin cuenta" }).click();
  await page
    .getByRole("link", { name: /Grabar partida nueva|Nueva partida/i })
    .first()
    .click();
  await page.waitForURL("**/new*");
  await expect(page.getByRole("heading", { name: "Grabar partida nueva" })).toBeVisible();
}

/** Crea una partida de todos contra todos con los nombres dados y llega a su pantalla (aún sin empezar). */
export async function createSoloGame(page: Page, players: string[], rounds: number) {
  await guestToNewGame(page);
  for (const [i, name] of players.entries()) {
    const field = page.getByRole("textbox", { name: `Jugador ${i + 1}`, exact: true });
    if (!(await field.count())) await page.getByRole("button", { name: "Añadir jugador" }).click();
    await page.getByRole("textbox", { name: `Jugador ${i + 1}`, exact: true }).fill(name);
  }
  const roundsField = page.getByRole("textbox", { name: "Rondas", exact: true });
  await roundsField.fill(String(rounds));
  await roundsField.press("Enter");
  await page.getByRole("button", { name: "Grabar y empezar" }).click();
  await page.waitForURL("**/game/*");
  await expect(page.getByRole("button", { name: /^Empezar/ })).toBeVisible();
}
