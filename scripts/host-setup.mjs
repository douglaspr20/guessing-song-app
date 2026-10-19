// Genera los secretos del anfitrión: `npm run host:setup`.
// Pide la contraseña sin mostrarla y escribe en pantalla las variables para .env (y para Vercel).
// Nada se guarda en disco: copia la salida tú mismo.
import { randomBytes, scrypt } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const MIN_LENGTH = 12;

function base32(data) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/** Mismo formato que src/lib/access/password.ts: scrypt:N:r:p:sal:hash (sin «$», que .env expandiría). */
function hashPassword(password) {
  const params = { N: 16384, r: 8, p: 1 };
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 32, { ...params, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err
        ? reject(err)
        : resolve(["scrypt", params.N, params.r, params.p, salt.toString("base64"), key.toString("base64")].join(":")),
    ),
  );
}

/** Lee una línea sin mostrar lo que se escribe (si la terminal lo permite). */
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    if (!stdin.isTTY) {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.split(/\r?\n/)[0] ?? ""));
      return;
    }
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\u0003") process.exit(130); // Ctrl+C
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await askHidden(`Contraseña del anfitrión (mínimo ${MIN_LENGTH} caracteres): `);
if (password.length < MIN_LENGTH) {
  console.error(`\nDemasiado corta: usa al menos ${MIN_LENGTH} caracteres (mejor una frase).`);
  process.exit(1);
}
if (process.stdin.isTTY) {
  const again = await askHidden("Repítela: ");
  if (again !== password) {
    console.error("\nNo coinciden. Vuelve a ejecutar el script.");
    process.exit(1);
  }
}

const totpSecret = base32(randomBytes(20));
const label = encodeURIComponent("Adivina la canción:anfitrion");
const otpauth = `otpauth://totp/${label}?secret=${totpSecret}&issuer=${encodeURIComponent("Adivina la canción")}&digits=6&period=30`;

console.log(`
Copia estas líneas en .env (y como variables «Sensitive» en Vercel). No las subas al repo.

HOST_PASSWORD_HASH="${await hashPassword(password)}"
HOST_TOTP_SECRET="${totpSecret}"
TOKEN_ENCRYPTION_KEY="${randomBytes(32).toString("base64")}"
CRON_SECRET="${randomBytes(24).toString("base64url")}"

Añade el código a tu app de autenticación (Google Authenticator, 1Password, Authy…):
  - Clave manual: ${totpSecret.match(/.{4}/g).join(" ")}
  - O este enlace otpauth: ${otpauth}

Si cambias TOKEN_ENCRYPTION_KEY más adelante, tendrás que volver a conectar Spotify.
`);
