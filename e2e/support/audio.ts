import type { BrowserContext } from "@playwright/test";
import { FAKE_PREVIEW_HOST } from "../../src/lib/itunes/fake";

/** 30 s de silencio (WAV de 8 kHz, 8 bits, mono): lo bastante largo para que el fragmento no «termine» solo. */
function silence(seconds = 30): Buffer {
  const rate = 8000;
  const data = Buffer.alloc(rate * seconds, 0x80);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const WAV = silence();

/** Las vistas previas falsas apuntan al servidor de Apple: el navegador recibe silencio en vez de salir a internet. */
export async function stubPreviews(context: BrowserContext) {
  await context.route(`https://${FAKE_PREVIEW_HOST}/**`, (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: WAV, headers: { "accept-ranges": "bytes" } }),
  );
}
