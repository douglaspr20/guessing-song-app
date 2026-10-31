// Graba el GIF del README (docs/demo.gif) y las capturas para LinkedIn (media/linkedin/) jugando una partida de
// verdad: la tele y un móvil, con canciones reales de iTunes.
//
//   node scripts/capture-media.mjs
//
// Necesita la base de Docker (`npm run db:up`) y la app compilada (`npm run build`). Levanta `next start` en el
// puerto 3107 con la base local de desarrollo y lo para al acabar. Usa iTunes de verdad (pocas búsquedas, pasan por
// la caché). Nunca lo apuntes a producción.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "@playwright/test";
import gifenc from "gifenc";
import pg from "pg";
import pngjs from "pngjs";

// Los dos son CommonJS: se importan enteros.
const { GIFEncoder, applyPalette, quantize } = gifenc;
const { PNG } = pngjs;

const PORT = 3107;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const GIF_OUT = path.join(ROOT, "docs", "demo.gif");
const SHOTS = path.join(ROOT, "media", "linkedin");
/** Tamaño del GIF: la tele (16:9) a la izquierda y el móvil a la derecha. */
const GIF = { width: 1080, height: 504, pad: 28, gap: 26 };

// ---------- Entorno ----------

/** Lee `.env.local` y `.env` (como Next) para saber a qué base conectarse. */
function loadEnv() {
  const env = {};
  for (const file of [".env", ".env.local"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}

async function portInUse() {
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await portInUse()) throw new Error(`El puerto ${PORT} ya está en uso: para ese servidor antes de grabar.`);
  const env = { ...process.env };
  delete env.E2E_FAKE_ITUNES; // canciones de verdad
  const server = spawn(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], {
    cwd: ROOT,
    env,
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    if (await portInUse()) return server;
    await sleep(1000);
  }
  server.kill();
  throw new Error("El servidor no arrancó en 60 s (¿falta `npm run build`?).");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Fotogramas ----------

/** Pares tele + móvil con lo que duran en el GIF. */
const frames = [];

async function snap(tv, phone, holdMs = 0) {
  // Al sonar, el cursor salta al formulario y baja la página: el casete tiene que verse entero.
  await tv.evaluate(() => window.scrollTo(0, 0));
  const at = Date.now();
  const [tvPng, phonePng] = await Promise.all([tv.screenshot(), phone.screenshot()]);
  if (frames.length) frames.at(-1).ms = Math.max(frames.at(-1).ms, at - frames.at(-1).at);
  frames.push({ tv: tvPng, phone: phonePng, at, ms: holdMs || 400 });
}

/** Unos segundos de movimiento (la cinta, la cuenta atrás): un fotograma cada `everyMs`. */
async function film(tv, phone, seconds, everyMs = 700) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    await snap(tv, phone);
    await sleep(Math.max(0, everyMs - 250));
  }
}

const dataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;

/** Compone la tele y el móvil en una página y la fotografía (sin librerías de imagen). */
async function compose(page, tvPng, phonePng) {
  const h = GIF.height - GIF.pad * 2;
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#1d2747;width:${GIF.width}px;height:${GIF.height}px;display:flex;align-items:center;justify-content:center;gap:${GIF.gap}px">
    <img src="${dataUrl(tvPng)}" style="height:${h}px;border-radius:14px;box-shadow:0 0 0 3px #314172">
    <img src="${dataUrl(phonePng)}" style="height:${h}px;border-radius:22px;box-shadow:0 0 0 6px #10172e,0 0 0 9px #314172">
  </body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  return page.screenshot({ clip: { x: 0, y: 0, width: GIF.width, height: GIF.height } });
}

async function writeGif(page) {
  const gif = GIFEncoder();
  for (const [i, f] of frames.entries()) {
    const composed = await compose(page, f.tv, f.phone);
    if (process.env.FRAMES_DIR) {
      fs.mkdirSync(process.env.FRAMES_DIR, { recursive: true });
      fs.writeFileSync(path.join(process.env.FRAMES_DIR, `${String(i).padStart(3, "0")}.png`), composed);
    }
    const png = PNG.sync.read(composed);
    const palette = quantize(png.data, 256);
    const index = applyPalette(png.data, palette);
    // El último fotograma (el podio) se queda más rato antes de volver a empezar.
    const delay = i === frames.length - 1 ? 3500 : Math.min(2500, Math.max(120, f.ms));
    gif.writeFrame(index, png.width, png.height, { palette, delay });
  }
  gif.finish();
  fs.writeFileSync(GIF_OUT, gif.bytes());
}

// ---------- Capturas para LinkedIn ----------

async function savePng(name, buffer) {
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, name), buffer);
}

/** Los dos móviles lado a lado en vertical (1080×1350), con un marco cada uno. */
async function phonePair(page, left, right) {
  await page.setViewportSize({ width: 1080, height: 1350 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#1d2747;width:1080px;height:1350px;display:flex;align-items:center;justify-content:center;gap:64px">
    ${[left, right].map((p) => `<img src="${dataUrl(p)}" style="height:900px;border-radius:40px;box-shadow:0 0 0 12px #10172e,0 0 0 18px #314172">`).join("")}
  </body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  return page.screenshot();
}

// ---------- La partida ----------

/** Reconocimiento de voz falso: «oye» `window.__dictado` palabra a palabra, como el de verdad. */
function fakeSpeech() {
  class FakeRecognition {
    lang = "";
    interimResults = false;
    continuous = false;
    maxAlternatives = 1;
    onresult = null;
    onerror = null;
    onend = null;
    start() {
      const words = String(window.__dictado ?? "").split(/\s+/).filter(Boolean);
      words.forEach((_, i) =>
        setTimeout(() => this.onresult?.({ results: [[{ transcript: words.slice(0, i + 1).join(" ") }]] }), 500 + i * 350),
      );
      setTimeout(() => this.onend?.(), 900 + words.length * 350);
    }
    stop() {
      this.onend?.();
    }
    abort() {}
  }
  Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
}

async function main() {
  const env = loadEnv();
  const db = new pg.Client({ connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL });
  await db.connect();
  /** Título y primer artista de la ronda que suena (lo que el móvil «dicta»). */
  const playingTrack = async (gameId) => {
    const { rows } = await db.query(
      `SELECT "trackName", artists FROM "Round" WHERE "gameId" = $1 AND status = 'PLAYING' ORDER BY number DESC LIMIT 1`,
      [gameId],
    );
    return { title: rows[0]?.trackName ?? "", artist: JSON.parse(rows[0]?.artists ?? "[]")[0] ?? "" };
  };

  const server = await startServer();
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    // La tele (el navegador del anfitrión). A 1,5× para que las capturas salgan a 1920×1080.
    const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, locale: "es-ES", baseURL: BASE });
    const tv = await tvCtx.newPage();
    await tv.goto("/");
    await tv.getByRole("button", { name: "Jugar sin cuenta" }).click();
    await tv.getByRole("link", { name: /Grabar partida nueva|Nueva partida/i }).first().click();
    await tv.waitForURL("**/new*");

    // Crear partida: jugadores, géneros, idioma y años.
    await tv.setViewportSize({ width: 1440, height: 900 });
    const names = ["Ana", "Luis", "Marta"];
    for (const [i, name] of names.entries()) {
      const field = tv.getByRole("textbox", { name: `Jugador ${i + 1}`, exact: true });
      if (!(await field.count())) await tv.getByRole("button", { name: "Añadir jugador" }).click();
      await tv.getByRole("textbox", { name: `Jugador ${i + 1}`, exact: true }).fill(name);
    }
    await tv.getByRole("button", { name: "Pop latino", exact: true }).click();
    await tv.getByRole("button", { name: "Pop", exact: true }).click();
    await tv.getByRole("combobox", { name: "Idioma" }).selectOption("es-latam");
    await tv.getByLabel("Desde").fill("2000");
    await tv.getByLabel("Hasta").fill("2015");
    const rounds = tv.getByRole("textbox", { name: "Rondas", exact: true });
    await rounds.fill("2");
    await rounds.press("Enter");
    await tv.evaluate(() => window.scrollTo(0, 0));
    await savePng("4-crear-partida.png", await tv.screenshot());
    await tv.getByRole("button", { name: "Pop latino", exact: true }).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await sleep(300);
    await savePng("4-crear-partida-generos.png", await tv.screenshot());

    await tv.getByRole("button", { name: "Grabar y empezar" }).click();
    await tv.waitForURL("**/game/*");
    await tv.setViewportSize({ width: 1280, height: 720 });
    const gameId = new URL(tv.url()).pathname.split("/").pop();
    const { rows } = await db.query(`SELECT code FROM "Game" WHERE id = $1`, [gameId]);
    const code = rows[0].code;

    // El móvil de Luis se une con el código.
    const phoneCtx = await browser.newContext({ ...devices["Pixel 7"], locale: "es-ES", baseURL: BASE });
    await phoneCtx.addInitScript(fakeSpeech);
    const phone = await phoneCtx.newPage();
    await phone.goto("/join");
    await snap(tv, phone, 1600);
    await phone.getByLabel("Código de la partida").fill(code);
    await snap(tv, phone, 900);
    await phone.getByRole("button", { name: "Continuar" }).click();
    await phone.getByLabel("Tu nombre").fill("Luis");
    await snap(tv, phone, 900);
    await phone.getByRole("button", { name: "Entrar", exact: true }).click();
    await phone.getByRole("heading", { name: "Esperando a que empiece" }).waitFor();
    await tv.getByText("Luis").first().waitFor();
    await snap(tv, phone, 1400);

    // Ronda 1: suena, salen las pistas, Luis pulsa y dicta el título.
    await tv.getByRole("button", { name: /^Empezar/ }).click();
    await film(tv, phone, 3.2, 500); // entreacto 3, 2, 1
    await tv.getByRole("region", { name: "Casete de la pista" }).waitFor();
    await film(tv, phone, 11, 900); // la cinta corre y sale la primera pista
    await savePng("2-movil-lo-se.png", await phone.screenshot());
    const buzz = phone.getByRole("button", { name: "¡Lo sé!" });
    await buzz.click();
    await phone.getByRole("form", { name: "Tu respuesta" }).waitFor();
    await tv.getByRole("region", { name: "Turno de respuesta" }).waitFor({ timeout: 15_000 });
    await phone.locator(":focus").blur().catch(() => {});
    await sleep(300);
    await snap(tv, phone, 1200);
    // Dicta el título y luego el artista (el artista suma +1 antes de que salga como pista).
    const { title: first, artist } = await playingTrack(gameId);
    const dictate = async (text, button) => {
      await phone.evaluate((t) => Object.assign(window, { __dictado: t }), text);
      await phone.getByRole("button", { name: button }).click();
      await film(tv, phone, 0.5 + text.split(/\s+/).length * 0.35 + 0.6, 350);
    };
    await dictate(first, "Dictar la canción");
    await phone.evaluate((t) => Object.assign(window, { __dictado: t }), artist);
    await phone.getByRole("button", { name: "Dictar el artista" }).click();
    await sleep(500 + Math.min(2, artist.split(/\s+/).length) * 350);
    await savePng("2-movil-dictado.png", await phone.screenshot());
    await film(tv, phone, 1.2, 350);
    await snap(tv, phone, 900);
    await phone.getByRole("button", { name: "Enviar respuesta" }).click();
    await tv.getByText(`Era ${first}`).waitFor({ timeout: 15_000 });
    await sleep(600);
    await snap(tv, phone, 2600);

    // Ronda 2: la cinta corre, salen pistas y Marta lo dice en voz alta (el anfitrión se lo apunta).
    await tv.getByRole("button", { name: /Siguiente pista/ }).click();
    await film(tv, phone, 3.2, 500);
    await tv.getByRole("region", { name: "Casete de la pista" }).waitFor();
    await film(tv, phone, 11.5, 1100);
    await tv.evaluate(() => window.scrollTo(0, 0));
    await savePng("1-tele-ronda.png", await tv.screenshot());
    await tv.getByRole("radio", { name: /Marta/ }).check({ force: true });
    await tv.getByRole("button", { name: /¡Acertó la canción!/ }).click();
    const second = await db
      .query(`SELECT "trackName" FROM "Round" WHERE "gameId" = $1 ORDER BY number DESC LIMIT 1`, [gameId])
      .then((r) => r.rows[0].trackName);
    await tv.getByText(`Era ${second}`).waitFor({ timeout: 15_000 });
    await sleep(600);
    await snap(tv, phone, 2400);

    // Podio.
    await tv.getByRole("button", { name: /Ver el podio/ }).click();
    await tv.getByRole("heading", { level: 1 }).waitFor();
    await phone.reload();
    await film(tv, phone, 2.5, 600); // el confeti cae
    await sleep(4000); // y termina: la captura limpia
    await snap(tv, phone, 3500);
    await savePng("3-podio.png", await tv.screenshot());

    // La tarjeta para compartir (apaisada y vertical).
    await tv.getByRole("button", { name: "Compartir resultado" }).click();
    const link = await tv.getByRole("dialog", { name: "Compartir este resultado" }).getByRole("textbox", { name: "Enlace al resultado" }).inputValue();
    const token = link.split("/r/")[1];
    for (const v of ["wide", "tall"]) {
      const res = await tvCtx.request.get(`/r/${token}/image?v=${v}`);
      await savePng(`3-tarjeta-${v === "wide" ? "apaisada" : "vertical"}.png`, await res.body());
    }

    // Composiciones: el GIF y los dos móviles lado a lado.
    const studio = await (await browser.newContext({ viewport: { width: GIF.width, height: GIF.height } })).newPage();
    await writeGif(studio);
    await savePng(
      "2-movil-pareja.png",
      await phonePair(studio, fs.readFileSync(path.join(SHOTS, "2-movil-lo-se.png")), fs.readFileSync(path.join(SHOTS, "2-movil-dictado.png"))),
    );
    console.log(`GIF: ${frames.length} fotogramas, ${(fs.statSync(GIF_OUT).size / 1e6).toFixed(1)} MB → ${path.relative(ROOT, GIF_OUT)}`);
    console.log(`Capturas → ${path.relative(ROOT, SHOTS)}: ${fs.readdirSync(SHOTS).join(", ")}`);
  } finally {
    await browser.close();
    server.kill();
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
