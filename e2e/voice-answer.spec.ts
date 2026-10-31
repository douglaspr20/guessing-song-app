import type { BrowserContext, Page } from "@playwright/test";
import { expect, phoneContext, test } from "./support/test";
import { lastGameCode, playingRound } from "./support/db";
import { createSoloGame } from "./support/flows";

/**
 * Reconocimiento de voz falso: «oye» lo que la prueba deja en `window.__dictado` y acaba. Así se prueba el botón sin
 * micrófono ni servicio de Google/Apple. `lang` queda en `window.__dictadoLang` para comprobar el idioma.
 */
async function fakeSpeech(context: BrowserContext) {
  await context.addInitScript(() => {
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const w = window as unknown as { __dictado?: string; __dictadoLang?: string };
        w.__dictadoLang = this.lang;
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: w.__dictado ?? "" }]] });
          this.onend?.();
        }, 50);
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
}

/** Sin reconocimiento de voz (como Firefox o algunos navegadores dentro de apps). */
async function noSpeech(context: BrowserContext) {
  await context.addInitScript(() => {
    for (const k of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      Object.defineProperty(window, k, { value: undefined, configurable: true });
    }
  });
}

/** Partida con un móvil dentro que ya pulsó «¡Lo sé!» y tiene el formulario de respuesta. */
async function phoneInTurn(page: Page, phone: BrowserContext) {
  await createSoloGame(page, ["Ana", "Luis"], 2);
  const code = await lastGameCode();
  const mobile = await phone.newPage();
  await mobile.goto("/join");
  await mobile.getByLabel("Código de la partida").fill(code);
  await mobile.getByRole("button", { name: "Continuar" }).click();
  await mobile.getByLabel("Tu nombre").fill("Pablo");
  await mobile.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(mobile.getByRole("heading", { name: "Esperando a que empiece" })).toBeVisible();
  await page.getByRole("button", { name: /^Empezar/ }).click();
  const buzz = mobile.getByRole("button", { name: "¡Lo sé!" });
  await expect(buzz).toBeEnabled({ timeout: 15_000 });
  await buzz.click();
  await expect(mobile.getByRole("form", { name: "Tu respuesta" })).toBeVisible({ timeout: 15_000 });
  return mobile;
}

test("dictar la respuesta: el micrófono de «Canción» rellena el campo y la respuesta acierta", async ({ page, browser, baseURL }) => {
  const phone = await phoneContext(browser, baseURL);
  await fakeSpeech(phone);
  const mobile = await phoneInTurn(page, phone);
  const round = await playingRound();

  await mobile.evaluate((t) => Object.assign(window, { __dictado: t }), round.trackName);
  await mobile.getByRole("button", { name: "Dictar la canción" }).click();
  await expect(mobile.getByLabel("Canción", { exact: true })).toHaveValue(round.trackName);
  // La partida no eligió idioma de la música: se escucha en el de la pantalla.
  expect(await mobile.evaluate(() => (window as unknown as { __dictadoLang?: string }).__dictadoLang)).toBe("es-ES");

  await mobile.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByText(`Era ${round.trackName}`)).toBeVisible({ timeout: 15_000 });
  await phone.close();
});

test("sin reconocimiento de voz en el navegador no hay botón: se sugiere el micrófono del teclado", async ({ page, browser, baseURL }) => {
  const phone = await phoneContext(browser, baseURL);
  await noSpeech(phone);
  const mobile = await phoneInTurn(page, phone);

  await expect(mobile.getByRole("button", { name: "Dictar la canción" })).toHaveCount(0);
  await expect(mobile.getByText("También puedes dictar con el micrófono del teclado.")).toBeAttached();
  await phone.close();
});
