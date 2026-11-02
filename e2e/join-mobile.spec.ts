import { expect, phoneContext, test } from "./support/test";
import { lastGameCode, playingRound, roundPaused } from "./support/db";
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
  // Como la canción sigue sonando (el modo normal), su nombre se pega en grande sobre el casete y la ronda no se pausa.
  await expect(page.getByText("¡Pablo!")).toBeVisible();
  await expect(page.getByText("Tiene el turno", { exact: true })).toBeVisible();
  expect(await roundPaused()).toBe(false);
  const round = await playingRound();
  // La ronda guarda de qué búsqueda salió la canción.
  expect(round.pickedVia).toMatch(/^itunes: .+ \([A-Z]{2}\) (hits|mix|gems)$/);
  await mobile.getByLabel("Canción", { exact: true }).fill(round.trackName);
  await mobile.getByRole("button", { name: "Enviar respuesta" }).click();

  await expect(page.getByText(`Era ${round.trackName}`)).toBeVisible({ timeout: 15_000 });
  await phone.close();
});

test("después de una partida, volver a «Unirme con un código» deja escribir otro código y entrar", async ({ page, browser, baseURL }) => {
  await createSoloGame(page, ["Ana", "Luis"], 1);
  const first = await lastGameCode();

  const phone = await phoneContext(browser, baseURL);
  const mobile = await phone.newPage();
  await mobile.goto("/join");
  await mobile.getByLabel("Código de la partida").fill(first);
  await mobile.getByRole("button", { name: "Continuar" }).click();
  await mobile.getByLabel("Tu nombre").fill("Pablo");
  await mobile.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(mobile.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();

  // El anfitrión graba otra partida; el móvil vuelve al inicio y a «Unirme con un código» sin recargar.
  await page.goto("/");
  await page.getByRole("link", { name: "Grabar partida nueva" }).click();
  await page.getByRole("textbox", { name: "Jugador 1", exact: true }).fill("Ana");
  await page.getByRole("textbox", { name: "Jugador 2", exact: true }).fill("Luis");
  await page.getByRole("button", { name: "Grabar y empezar" }).click();
  await page.waitForURL("**/game/*");
  const second = await lastGameCode();
  expect(second).not.toBe(first);
  await mobile.getByRole("link", { name: "Adivina la canción" }).click();
  await mobile.getByRole("link", { name: "Unirme con un código" }).click();
  await mobile.waitForURL("**/join");

  // Empieza de cero (no con la partida de antes y el botón en «Entrando…») y el código nuevo funciona.
  const codeField = mobile.getByLabel("Código de la partida");
  await expect(codeField).toHaveValue("");
  await codeField.fill(second);
  await mobile.getByRole("button", { name: "Continuar" }).click();
  await mobile.getByLabel("Tu nombre").fill("Pablo");
  await mobile.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(mobile.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();
  await phone.close();
});

test("cuando alguien toma el turno, los demás móviles ven su nombre pegado sobre el botón", async ({ page, browser, baseURL }) => {
  await createSoloGame(page, ["Ana", "Luis"], 1);
  const code = await lastGameCode();

  const join = async (name: string) => {
    const ctx = await phoneContext(browser, baseURL);
    const p = await ctx.newPage();
    await p.goto("/join");
    await p.getByLabel("Código de la partida").fill(code);
    await p.getByRole("button", { name: "Continuar" }).click();
    await p.getByLabel("Tu nombre").fill(name);
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(p.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();
    return { ctx, p };
  };
  const pablo = await join("Pablo");
  const marta = await join("Marta");

  await page.getByRole("button", { name: /^Empezar/ }).click();
  const buzz = pablo.p.getByRole("button", { name: "¡Lo sé!" });
  await expect(buzz).toBeEnabled({ timeout: 15_000 });
  await buzz.click();

  await expect(marta.p.getByText("¡Pablo!")).toBeVisible({ timeout: 15_000 });
  await expect(marta.p.getByText("Tiene el turno", { exact: true })).toBeVisible();
  await marta.p.screenshot({ path: "test-results/turn-sticker-phone.png" });
  // Y después, la línea de siempre bajo el botón apagado.
  await expect(marta.p.getByText(/Pablo tiene el turno/)).toBeVisible();
  await pablo.ctx.close();
  await marta.ctx.close();
});
