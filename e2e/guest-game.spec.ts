import { expect, test } from "./support/test";
import { playingRound } from "./support/db";
import { createSoloGame } from "./support/flows";

test("un invitado graba una partida, la juega entera y llega al podio", async ({ page }) => {
  await createSoloGame(page, ["Ana", "Luis"], 2);

  // Ronda 1: Luis acierta la canción.
  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  const first = await playingRound();
  await page.getByRole("radio", { name: /Luis/ }).check({ force: true });
  await page.getByRole("button", { name: /¡Acertó la canción!/ }).click();
  await expect(page.getByText(`Era ${first.trackName}`)).toBeVisible();
  await expect(page.getByText("Luis: ¡acertó la canción! +3")).toBeVisible();

  // Ronda 2: nadie la sabe, el anfitrión la revela.
  await page.getByRole("button", { name: /Siguiente pista/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  await page.getByRole("button", { name: /Revelar/ }).click();
  await expect(page.getByText("Nadie la adivinó esta vez.")).toBeVisible();

  // Podio: gana Luis y la partida queda guardada en la estantería.
  await page.getByRole("button", { name: /Ver el podio/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Luis");
  await page.getByRole("link", { name: "Volver a la estantería" }).click();
  await page.waitForURL("**/");
  await expect(page.getByRole("heading", { name: "Tu estantería" })).toBeVisible();
  await expect(page.getByText("C-001").first()).toBeVisible();
});
