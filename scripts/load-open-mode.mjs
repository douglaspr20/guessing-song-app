// Prueba de carga del modo abierto, SOLO en local: muchos invitados a la vez juegan partidas enteras
// contra `next start` con el Postgres de Docker y el iTunes falso (E2E_FAKE_ITUNES=1).
// Nunca contra producción ni contra iTunes de verdad: provocaría justo el bloqueo que queremos evitar.
//
// Uso:  node scripts/load-open-mode.mjs [url=http://127.0.0.1:3100] [invitados=40] [rondas=5] [misma-ip]
//   - Cada invitado lleva su propia IP (X-Forwarded-For) salvo con «misma-ip», que simula una oficina tras una sola IP.
//   - Mientras juega, consulta la partida cada 3 s como la tele y dos móviles sin Ably.

const [base = "http://127.0.0.1:3100", guestsArg = "40", roundsArg = "5", ipMode] = process.argv.slice(2);
const GUESTS = Number(guestsArg);
const ROUNDS = Number(roundsArg);
const SAME_IP = ipMode === "misma-ip";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) {
  console.error("Solo contra un servidor local (http://127.0.0.1:PUERTO).");
  process.exit(1);
}

const timings = new Map(); // endpoint -> ms[]
const errors = new Map(); // "endpoint código" -> n

async function call(name, path, { cookie, ip, method = "GET", body } = {}) {
  const started = performance.now();
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      "x-forwarded-for": ip,
      // Como un navegador en la misma web: la API rechaza los POST de otro origen.
      origin: base,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = performance.now() - started;
  (timings.get(name) ?? timings.set(name, []).get(name)).push(ms);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const key = `${name} ${res.status} ${data?.error ?? ""}`.trim();
    errors.set(key, (errors.get(key) ?? 0) + 1);
    throw new Error(key);
  }
  return { data, setCookie: res.headers.getSetCookie?.() ?? [] };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function guestPlays(i) {
  const ip = SAME_IP ? "10.0.0.1" : `10.0.${Math.floor(i / 250)}.${(i % 250) + 1}`;
  const guest = await call("POST /api/guest", "/api/guest", { ip, method: "POST" });
  const cookie = guest.setCookie.map((c) => c.split(";")[0]).join("; ");
  const opts = { cookie, ip };

  const { data: game } = await call("POST /api/games", "/api/games", {
    ...opts,
    method: "POST",
    body: { mode: "open", rounds: ROUNDS, players: ["Ana", "Luis", "Marta"] },
  });

  // La tele y dos móviles sin Ably sondean la partida cada 3 s mientras dura.
  let playing = true;
  const pollers = [0, 1, 2].map(async (k) => {
    await sleep(k * 1000);
    while (playing) {
      await call("GET /api/games/:id", `/api/games/${game.id}`, opts).catch(() => undefined);
      await sleep(3000);
    }
  });

  try {
    for (let r = 0; r < ROUNDS; r++) {
      const { data } = await call("POST rounds", `/api/games/${game.id}/rounds`, { ...opts, method: "POST" });
      const roundId = data?.round?.id ?? data?.id;
      await sleep(2000 + Math.random() * 3000); // suena un rato
      await call("POST reveal", `/api/games/${game.id}/rounds/${roundId}/reveal`, { ...opts, method: "POST" });
      await sleep(1000);
    }
  } finally {
    playing = false;
    await Promise.all(pollers);
  }
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

const started = performance.now();
const results = await Promise.allSettled(Array.from({ length: GUESTS }, (_, i) => sleep(Math.random() * 5000).then(() => guestPlays(i))));
const seconds = ((performance.now() - started) / 1000).toFixed(1);

console.log(`\n${GUESTS} invitados · ${ROUNDS} rondas · ${SAME_IP ? "misma IP" : "IP distintas"} · ${seconds} s`);
console.log(`Partidas completas: ${results.filter((r) => r.status === "fulfilled").length}/${GUESTS}\n`);
console.log("endpoint".padEnd(24), "n".padStart(6), "p50 ms".padStart(8), "p95 ms".padStart(8), "max ms".padStart(8));
for (const [name, list] of timings) {
  const s = [...list].sort((a, b) => a - b);
  console.log(name.padEnd(24), String(s.length).padStart(6), pct(s, 50).toFixed(0).padStart(8), pct(s, 95).toFixed(0).padStart(8), s.at(-1).toFixed(0).padStart(8));
}
if (errors.size) {
  console.log("\nErrores:");
  for (const [key, n] of errors) console.log(`  ${key}: ${n}`);
}
