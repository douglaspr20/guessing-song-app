import { expect, phoneContext, test } from "./support/test";
import { HOST_PASSWORD } from "./support/env";
import { lastGameCode } from "./support/db";
import { createSoloGame } from "./support/flows";
import { hostCode } from "./support/host";

test("«Otra igual»: la tele repite la partida, el móvil se pasa solo y el panel lo cuenta", async ({ page, browser, baseURL }) => {
  // Partida de una ronda con Ana y Luis; Pablo se une desde el móvil.
  await createSoloGame(page, ["Ana", "Luis"], 1);
  const oldGameUrl = page.url();
  const code = await lastGameCode();
  const phone = await phoneContext(browser, baseURL);
  const mobile = await phone.newPage();
  await mobile.goto("/join");
  await mobile.getByLabel("Código de la partida").fill(code);
  await mobile.getByRole("button", { name: "Continuar" }).click();
  await mobile.getByLabel("Tu nombre").fill("Pablo");
  await mobile.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(mobile.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();
  await expect(page.getByText("Pablo").first()).toBeVisible({ timeout: 15_000 });

  // Se juega la única ronda y se llega al podio.
  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  await page.getByRole("button", { name: /Revelar/ }).click();
  await page.getByRole("button", { name: /Ver el podio/ }).click();
  await expect(page.getByRole("button", { name: "Otra igual" })).toBeVisible();

  // Un clic: otra partida con las mismas personas (también Pablo, que entró desde el móvil).
  await page.getByRole("button", { name: "Otra igual" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/game/") && url.href !== oldGameUrl);
  const newGameUrl = page.url();
  await expect(page.getByRole("button", { name: /^Empezar/ })).toBeVisible();
  for (const name of ["Ana", "Luis", "Pablo"]) await expect(page.getByText(name).first()).toBeVisible();

  // El móvil de Pablo pasa solo a la nueva partida (le llega por el sondeo de 3 s) y sigue siendo Pablo.
  await mobile.waitForURL((url) => url.pathname.startsWith("/play/") && !oldGameUrl.endsWith(url.pathname.split("/")[2]), {
    timeout: 20_000,
  });
  await expect(mobile.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();
  await expect(mobile.getByText("Pablo").first()).toBeVisible();
  expect(newGameUrl).not.toBe(oldGameUrl);
  await phone.close();

  // El anfitrión ve en su panel dos partidas creadas (una «Otra igual»), una terminada y un móvil que siguió.
  await page.goto("/host");
  await page.getByLabel("Contraseña").fill(HOST_PASSWORD);
  await page.getByLabel("Código de 6 dígitos").fill(hostCode());
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cómo se usa" })).toBeVisible();
  const stats = await (await page.request.get("/api/host/stats?window=24h")).json();
  expect(stats).toMatchObject({
    guests: 1,
    funnel: { created: 2, started: 1, finished: 1 },
    replays: 1,
    phones: { joined: 1, followed: 1 },
  });
});
