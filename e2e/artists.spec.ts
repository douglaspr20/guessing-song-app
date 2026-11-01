import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { playingRound } from "./support/db";
import { guestToNewGame } from "./support/flows";

async function players(page: Page) {
  await page.getByRole("textbox", { name: "Jugador 1", exact: true }).fill("Ana");
  await page.getByRole("textbox", { name: "Jugador 2", exact: true }).fill("Luis");
}

test("elegir artistas desde /new: buscar, elegir, volver y que la partida suene con ellos", async ({ page }) => {
  await guestToNewGame(page);
  await players(page);

  await page.getByRole("button", { name: "Elegir artistas" }).click();
  await expect(page.getByRole("heading", { name: "Elegir artistas" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar artista" }).fill("Faroles");
  await page.getByRole("button", { name: "Elegir a Los Faroles" }).click();
  await expect(page.getByText("1 artista elegido")).toBeVisible();
  await page.getByRole("button", { name: "Listo" }).click();

  // De vuelta en el formulario, con todo lo de antes y el artista elegido.
  await expect(page.getByRole("heading", { name: "Grabar partida nueva" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Jugador 1", exact: true })).toHaveValue("Ana");
  await expect(page.getByRole("button", { name: "Quitar a Los Faroles" })).toBeVisible();

  await page.getByRole("button", { name: "Grabar y empezar" }).click();
  await page.waitForURL("**/game/*");
  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  expect(JSON.parse((await playingRound()).artists)).toEqual(["Los Faroles"]);
});

test("el botón Atrás del navegador cierra el selector sin perder el formulario", async ({ page }) => {
  await guestToNewGame(page);
  await players(page);
  await page.getByRole("button", { name: "Elegir artistas" }).click();
  await page.getByRole("button", { name: "Elegir a Marta Olmo" }).click();

  await page.goBack();

  await expect(page.getByRole("heading", { name: "Grabar partida nueva" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Jugador 2", exact: true })).toHaveValue("Luis");
  await expect(page.getByRole("button", { name: "Quitar a Marta Olmo" })).toBeVisible();
});

test("desde /artists se eligen artistas y se crea la partida con ellos", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jugar sin cuenta" }).click();
  await page.getByRole("link", { name: "Explorar artistas" }).click();
  await page.waitForURL("**/artists");

  // La época filtra el listado (las canciones falsas son de 2000 a 2019) y pasa a la partida.
  await page.getByRole("button", { name: "Años 2020" }).click();
  await expect(page.getByText("No encontré artistas con estos filtros. Prueba con otros.")).toBeVisible();
  await page.getByRole("button", { name: "Años 2000" }).click();

  await page.getByRole("button", { name: "Elegir a Marta Olmo" }).click();
  await page.getByRole("button", { name: "Elegir a Duo Marea" }).click();
  await expect(page.getByText("2 artistas elegidos")).toBeVisible();
  await page.getByRole("button", { name: "Crear partida con estos artistas" }).click();

  await page.waitForURL("**/new?**");
  await expect(page.getByRole("button", { name: "Quitar a Marta Olmo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quitar a Duo Marea" })).toBeVisible();
  await expect(page.getByLabel("Desde")).toHaveValue("2000");
  await expect(page.getByLabel("Hasta")).toHaveValue("2009");
});

test("si con los filtros no queda ninguna canción, la ronda empieza igual y la tele lo avisa", async ({ page }) => {
  await guestToNewGame(page);
  await players(page);
  await page.getByLabel("Desde").fill("1900");
  await page.getByLabel("Hasta").fill("1901");
  await page.getByRole("button", { name: "Grabar y empezar" }).click();
  await page.waitForURL("**/game/*");
  await page.getByRole("button", { name: /^Empezar/ }).click();

  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  await expect(page.getByText("Con esos filtros ya no quedaban canciones: esta vez sin los años.")).toBeVisible();
});
