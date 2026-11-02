// Graba los móviles del vídeo de LinkedIn. La tele es el navegador del anfitrión (con su cuenta y Spotify) y se graba
// aparte; aquí van dos móviles sin cuenta que se unen con el código y obedecen órdenes, para ir al compás de la tele.
//
//   node scripts/record-video.mjs
//
// Órdenes: una por línea en media/video/cmd.txt (se leen al vuelo):
//   join CÓDIGO             los dos móviles entran (Ana y Pablo)
//   buzz NOMBRE             pulsa «¡Lo sé!»
//   dictate NOMBRE TEXTO    dicta el título (reconocimiento de voz simulado)
//   submit NOMBRE           envía la respuesta
//   reload                  recarga los dos (para el podio)
//   end                     cierra y guarda los vídeos
// Los vídeos salen en media/video/raw, con la hora de inicio de cada uno en timeline.json para alinearlos con la tele.
// Apunta a VIDEO_BASE (por defecto producción): crea participantes reales en la partida.
import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "@playwright/test";

const BASE = process.env.VIDEO_BASE ?? "https://guessing-song-app.vercel.app";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "media", "video");
const RAW = path.join(OUT, "raw");
const CMD = path.join(OUT, "cmd.txt");
const PHONE = devices["Pixel 7"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timeline = { phones: {}, events: [] };
const mark = (event) => {
  timeline.events.push({ at: Date.now(), event });
  console.log(new Date().toISOString(), event);
};

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

async function openPhone(browser, name) {
  const ctx = await browser.newContext({
    ...PHONE,
    locale: "es-ES",
    baseURL: BASE,
    recordVideo: { dir: path.join(RAW, name), size: PHONE.viewport },
  });
  await ctx.addInitScript(fakeSpeech);
  const page = await ctx.newPage();
  timeline.phones[name] = { start: Date.now() };
  await page.goto("/join");
  return { ctx, page };
}

async function join(page, code, name) {
  await page.getByLabel("Código de la partida").fill(code);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("heading", { name: "Esperando a que empiece" }).waitFor({ timeout: 30_000 });
}

async function main() {
  fs.rmSync(RAW, { recursive: true, force: true });
  fs.mkdirSync(RAW, { recursive: true });
  fs.writeFileSync(CMD, "");
  const browser = await chromium.launch();
  const phones = { Ana: await openPhone(browser, "Ana"), Pablo: await openPhone(browser, "Pablo") };
  const who = (name) => {
    const phone = phones[name];
    if (!phone) throw new Error(`No hay móvil «${name}»`);
    return phone.page;
  };
  mark("listo");

  let done = 0;
  for (;;) {
    const lines = fs.readFileSync(CMD, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length === done) {
      await sleep(150);
      continue;
    }
    const line = lines[done++];
    const [cmd, name, ...rest] = line.trim().split(/\s+/);
    mark(line);
    try {
      if (cmd === "join") {
        await join(phones.Ana.page, name, "Ana");
        await join(phones.Pablo.page, name, "Pablo");
      } else if (cmd === "buzz") {
        await who(name).getByRole("button", { name: "¡Lo sé!" }).click({ timeout: 20_000 });
        await who(name).locator(":focus").blur().catch(() => {});
      } else if (cmd === "dictate") {
        const page = who(name);
        await page.evaluate((t) => Object.assign(window, { __dictado: t }), rest.join(" "));
        await page.getByRole("button", { name: "Dictar la canción" }).click();
      } else if (cmd === "submit") {
        await who(name).getByRole("button", { name: "Enviar respuesta" }).click();
      } else if (cmd === "reload") {
        await Promise.all(Object.values(phones).map((p) => p.page.reload()));
      } else if (cmd === "end") {
        break;
      }
      mark(`ok: ${line}`);
    } catch (err) {
      mark(`error: ${line}: ${err.message.split("\n")[0]}`);
    }
  }

  for (const [name, { ctx, page }] of Object.entries(phones)) {
    await ctx.close();
    timeline.phones[name].file = path.relative(ROOT, await page.video().path());
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(timeline, null, 2));
  console.log("Vídeos de los móviles guardados en", path.relative(ROOT, RAW));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
