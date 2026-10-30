import type { Browser, Page } from "@playwright/test";
import { expect, phoneContext, test } from "./support/test";
import { lastGameCode } from "./support/db";
import { createSoloGame } from "./support/flows";

/** Un móvil nuevo (cookies propias) que escribe el código y el nombre; devuelve su página, ya en el paso del nombre. */
async function phoneAtName(browser: Browser, baseURL: string | undefined, code: string, name: string) {
  const context = await phoneContext(browser, baseURL);
  const phone = await context.newPage();
  await phone.goto("/join");
  await phone.getByLabel("Código de la partida").fill(code);
  await phone.getByRole("button", { name: "Continuar" }).click();
  await phone.getByLabel("Tu nombre").fill(name);
  await phone.getByRole("button", { name: "Entrar", exact: true }).click();
  return { context, phone };
}

/** La fila de la tele con la petición de ese nombre. */
const askOf = (tv: Page, name: string) => tv.getByRole("group", { name: `${name} pide volver a entrar` });

test("recuperar el sitio: el móvil pide entrar, la tele decide y el navegador viejo sale", async ({ page, browser, baseURL }) => {
  await createSoloGame(page, ["Ana", "Luis"], 2);
  const code = await lastGameCode();

  // Pablo entra desde un navegador (A).
  const a = await phoneAtName(browser, baseURL, code, "Pablo");
  await expect(a.phone.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();
  await expect(page.getByText("Pablo").first()).toBeVisible({ timeout: 15_000 });

  // Abre el enlace en otro navegador (B): su nombre está ocupado, y en vez de un error seco puede pedir entrar.
  const b = await phoneAtName(browser, baseURL, code, "Pablo");
  await expect(b.phone.getByText("Pablo ya está dentro desde otro navegador")).toBeVisible();
  await expect(b.phone.getByRole("button", { name: "Entrar", exact: true })).toHaveCount(0);
  await b.phone.getByRole("button", { name: "Soy yo: pedir entrar" }).click();
  await expect(b.phone.getByRole("heading", { name: "Esperando al anfitrión" })).toBeVisible();

  // La tele lo ve (llega por el sondeo de 3 s) y el anfitrión lo deja entrar.
  const ask = askOf(page, "Pablo");
  await expect(ask).toBeVisible({ timeout: 15_000 });
  await expect(ask).toContainText("el otro dispositivo sale de la partida");
  await ask.getByRole("button", { name: "Dejar entrar" }).click();
  await expect(ask).toBeHidden();

  // B entra solo con el sitio de Pablo; A, sin sitio.
  await b.phone.waitForURL("**/play/*", { timeout: 15_000 });
  await expect(b.phone.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();
  await expect(b.phone.getByText("Pablo").first()).toBeVisible();
  await expect(a.phone.getByRole("heading", { name: "Ya no estás en esta partida" })).toBeVisible({ timeout: 15_000 });
  await a.context.close();

  // Otro intento (C) que el anfitrión rechaza: vuelve al nombre con el motivo y B sigue dentro.
  const c = await phoneAtName(browser, baseURL, code, "Pablo");
  await c.phone.getByRole("button", { name: "Soy yo: pedir entrar" }).click();
  await expect(askOf(page, "Pablo")).toBeVisible({ timeout: 15_000 });
  await askOf(page, "Pablo").getByRole("button", { name: "No", exact: true }).click();
  await expect(c.phone.getByText("El anfitrión no te dejó entrar, o la petición caducó.")).toBeVisible({ timeout: 15_000 });
  await expect(c.phone.getByLabel("Tu nombre")).toBeVisible();
  await c.context.close();

  // Con la partida en marcha el panel va plegado: una petición lo abre sola y deja una insignia.
  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  const panel = page.locator("details", { hasText: "Únete con tu móvil" });
  await expect(panel).not.toHaveAttribute("open", "");
  const d = await phoneAtName(browser, baseURL, code, "Pablo");
  await d.phone.getByRole("button", { name: "Soy yo: pedir entrar" }).click();
  await expect(panel).toHaveAttribute("open", "", { timeout: 15_000 });
  await expect(panel.getByText("1 pide entrar")).toBeVisible();
  await askOf(page, "Pablo").getByRole("button", { name: "Dejar entrar" }).click();
  await d.phone.waitForURL("**/play/*", { timeout: 15_000 });
  await d.context.close();
  await b.context.close();
});
