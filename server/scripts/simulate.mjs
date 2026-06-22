// Dev simulator: pretends to be the in-game plugin so you can see the whole
// pipeline (status API, source switching, push, WebSocket) without a real
// Minecraft server. Players randomly join/leave every few seconds.
//
//   Terminal 1:  INGEST_TOKEN=dev npm run dev
//   Terminal 2:  INGEST_TOKEN=dev npm run simulate
//   Watch:       curl -s localhost:8080/api/status | jq
//
// Env: BASE_URL (default http://localhost:8080), INGEST_TOKEN, TICK_MS (3000)

import { randomUUID } from "node:crypto";

const BASE = (process.env.BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const TOKEN = process.env.INGEST_TOKEN || "";
const TICK_MS = Number(process.env.TICK_MS || 3000);

const POOL = ["Steve", "Alex", "Notch", "Bartek", "Kuba", "Zielony", "Mela"];
const uuids = new Map(POOL.map((name) => [name, randomUUID()]));
const online = new Set();

if (!TOKEN) {
  console.error("Set INGEST_TOKEN to the same value the server uses, e.g. INGEST_TOKEN=dev");
  process.exit(1);
}

async function post(path, body) {
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`  ! ${path} -> HTTP ${res.status}`);
  } catch (err) {
    console.error(`  ! cannot reach ${BASE}${path}: ${err.message}`);
  }
}

function toggleSomeone() {
  const name = POOL[Math.floor(Math.random() * POOL.length)];
  if (online.has(name)) {
    online.delete(name);
    return { name, type: "quit" };
  }
  online.add(name);
  return { name, type: "join" };
}

async function tick() {
  // Sometimes change one player, sometimes leave things as-is (just heartbeat).
  if (Math.random() < 0.7) {
    const { name, type } = toggleSomeone();
    await post("/api/ingest/event", { type, uuid: uuids.get(name), name });
    console.log(`${type === "join" ? "→ joined" : "← left  "} ${name}`);
  }
  const players = [...online].map((name) => ({ uuid: uuids.get(name), name }));
  await post("/api/ingest/heartbeat", { players });
  console.log(`  online now: ${players.map((p) => p.name).join(", ") || "(nobody)"}`);
}

console.log(`Simulating plugin against ${BASE} every ${TICK_MS}ms (Ctrl+C to stop)`);
await tick();
setInterval(tick, TICK_MS);
