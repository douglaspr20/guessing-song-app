import type { APIResponse } from "@playwright/test";
import { expect, phoneContext, test } from "./support/test";
import { lastGameCode, playingRound } from "./support/db";
import { createSoloGame } from "./support/flows";

/** Ancho y alto de un PNG (están en su cabecera). */
async function pngSize(res: APIResponse) {
  const body = await res.body();
  expect(body.subarray(1, 4).toString()).toBe("PNG");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

test("compartir el resultado: enlace con vista previa, imágenes, el móvil comparte y se puede retirar", async ({ page, browser, baseURL }) => {
  // Partida de una ronda: Luis la acierta y Pablo mira desde el móvil.
  await createSoloGame(page, ["Ana", "Luis"], 1);
  const code = await lastGameCode();
  const phone = await phoneContext(browser, baseURL);
  const mobile = await phone.newPage();
  await mobile.goto("/join");
  await mobile.getByLabel("Código de la partida").fill(code);
  await mobile.getByRole("button", { name: "Continuar" }).click();
  await mobile.getByLabel("Tu nombre").fill("Pablo");
  await mobile.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(mobile.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();

  await page.getByRole("button", { name: /^Empezar/ }).click();
  await expect(page.getByRole("region", { name: "Casete de la pista" })).toBeVisible();
  await playingRound();
  await page.getByRole("radio", { name: /Luis/ }).check({ force: true });
  await page.getByRole("button", { name: /¡Acertó la canción!/ }).click();
  await page.getByRole("button", { name: /Ver el podio/ }).click();

  // La tele comparte: se abre el modal con el enlace y la vista previa de la tarjeta. La pantalla final no crece.
  const trigger = page.getByRole("button", { name: "Compartir resultado" });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Compartir este resultado" });
  await expect(panel).toBeVisible();

  // Se cierra con Esc y devuelve el foco al botón; también con un clic en lo oscuro de alrededor.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(panel).toBeHidden();
  await trigger.click();
  await expect(panel).toBeVisible();

  await expect(panel.getByText(/Cualquiera con el enlace verá los nombres/)).toBeVisible();
  const url = await panel.getByRole("textbox", { name: "Enlace al resultado" }).inputValue();
  expect(url).toMatch(/\/r\/[\w-]{16}$/);
  const token = url.split("/r/")[1];
  await expect(panel.getByRole("img", { name: "Vista previa de la tarjeta del resultado" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Descargar apaisada" })).toHaveAttribute("href", `/r/${token}/image?v=wide`);
  await expect(panel.getByRole("link", { name: "Descargar vertical" })).toHaveAttribute("href", `/r/${token}/image?v=tall`);

  // Las dos imágenes existen, son PNG y miden lo que deben.
  const wide = await page.request.get(`/r/${token}/image?v=wide`);
  expect(wide.status()).toBe(200);
  expect(wide.headers()["content-type"]).toBe("image/png");
  expect(await pngSize(wide)).toEqual({ width: 1200, height: 630 });
  expect(await pngSize(await page.request.get(`/r/${token}/image?v=tall`))).toEqual({ width: 1080, height: 1350 });

  // Cualquiera, sin sesión, abre el enlace: ve el resultado y la invitación a jugar, y nada interno.
  const visitor = await browser.newContext({ baseURL, locale: "es-ES" });
  const shared = await visitor.newPage();
  await shared.goto(url);
  await expect(shared.getByRole("heading", { level: 1 })).toContainText("Luis");
  await expect(shared.getByRole("heading", { name: "¿Y tú, adivinas la canción?" })).toBeVisible();
  await expect(shared.getByRole("link", { name: "Jugar sin cuenta" })).toBeVisible();
  expect(await shared.content()).not.toContain(code);

  // Un rastreador (WhatsApp, LinkedIn…) recibe las etiquetas de la vista previa ya en el HTML.
  const html = await (await visitor.request.get(url, { headers: { "user-agent": "WhatsApp/2.23.20.0 A" } })).text();
  expect(html).toMatch(/<meta property="og:image" content="[^"]*\/r\/[\w-]{16}\/image\?v=wide"/);
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"');

  // El móvil de Pablo también puede compartir, y es el mismo enlace.
  await mobile.getByRole("button", { name: "Compartir resultado" }).click({ timeout: 20_000 });
  const mobilePanel = mobile.getByRole("dialog", { name: "Compartir este resultado" });
  expect(await mobilePanel.getByRole("textbox", { name: "Enlace al resultado" }).inputValue()).toBe(url);
  // En el móvil el modal no se sale de la pantalla y no trae «Dejar de compartir» (solo la tele).
  const box = (await mobilePanel.boundingBox())!;
  const viewport = mobile.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  await expect(mobilePanel.getByRole("button", { name: "Dejar de compartir" })).toHaveCount(0);
  await phone.close();

  // El anfitrión deja de compartir: el enlace y las imágenes dejan de funcionar.
  await panel.getByRole("button", { name: "Dejar de compartir" }).click();
  await page.getByRole("dialog", { name: "¿Dejar de compartir este resultado?" }).getByRole("button", { name: "Dejar de compartir" }).click();
  await expect(panel).toBeHidden();
  expect((await page.request.get(`/r/${token}/image?v=wide`)).status()).toBe(404);
  expect((await page.request.get(`/r/${token}/image?v=tall`)).status()).toBe(404);
  await shared.reload();
  await expect(shared.getByText("se perdió")).toBeVisible();
  await visitor.close();
});
