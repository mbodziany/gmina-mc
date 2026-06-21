import { EventEmitter } from "node:events";
import { status } from "minecraft-server-util";
import { config } from "./config.js";
import {
  markOnline,
  markOffline,
  markAllOffline,
  touch,
  onlinePlayerIds,
  type PlayerSnapshot,
} from "./db.js";
import { notifyJoin } from "./push.js";

export interface PollEvent {
  type: "join" | "leave" | "server-up" | "server-down" | "tick";
  name?: string;
  onlineCount: number;
}

/** Emits PollEvent objects so the API/WebSocket layer can push live updates. */
export const pollEvents = new EventEmitter();

let consecutiveFailures = 0;
let serverReachable = true;
export function isServerReachable(): boolean {
  return serverReachable;
}

function normalizeSample(sample: { name: string; id?: string }[] | null): PlayerSnapshot[] {
  if (!sample) return [];
  return sample
    .filter((s) => s.name && s.name.trim() !== "")
    .map((s) => ({
      // Vanilla online-mode servers return real UUIDs; fall back to the name otherwise.
      id: s.id && s.id !== "00000000-0000-0000-0000-000000000000" ? s.id : s.name.toLowerCase(),
      name: s.name,
    }));
}

async function pollOnce(): Promise<void> {
  let online: PlayerSnapshot[];
  let onlineCount: number;

  try {
    const res = await status(config.mc.host, config.mc.port, { timeout: 5000 });
    online = normalizeSample(res.players.sample);
    onlineCount = res.players.online;
    if (!serverReachable) {
      serverReachable = true;
      pollEvents.emit("event", { type: "server-up", onlineCount } satisfies PollEvent);
      console.log("[poll] server is reachable again");
    }
    consecutiveFailures = 0;
  } catch (err) {
    consecutiveFailures++;
    if (serverReachable && consecutiveFailures >= config.offlineGracePolls) {
      serverReachable = false;
      const dropped = markAllOffline();
      for (const _ of dropped) {
        /* sessions closed */
      }
      pollEvents.emit("event", { type: "server-down", onlineCount: 0 } satisfies PollEvent);
      console.warn(
        `[poll] server unreachable after ${consecutiveFailures} attempts; everyone marked offline`,
      );
    }
    return;
  }

  const previouslyOnline = onlinePlayerIds();
  const currentIds = new Set(online.map((p) => p.id));

  // Arrivals + keep-alive
  for (const p of online) {
    const wasOnline = previouslyOnline.has(p.id);
    const isNew = markOnline(p, wasOnline);
    if (isNew) {
      console.log(`[poll] ${p.name} joined (online: ${onlineCount})`);
      pollEvents.emit("event", {
        type: "join",
        name: p.name,
        onlineCount,
      } satisfies PollEvent);
      void notifyJoin(p.name, onlineCount);
    } else {
      touch(p.id);
    }
  }

  // Departures
  for (const id of previouslyOnline) {
    if (!currentIds.has(id)) {
      markOffline(id);
      console.log(`[poll] player ${id} left (online: ${onlineCount})`);
      pollEvents.emit("event", { type: "leave", onlineCount } satisfies PollEvent);
    }
  }

  pollEvents.emit("event", { type: "tick", onlineCount } satisfies PollEvent);
}

export function startPoller(): void {
  if (!config.mc.host) {
    console.error("[poll] MC_HOST is empty — poller disabled.");
    return;
  }
  console.log(
    `[poll] monitoring ${config.mc.host}${config.mc.port ? ":" + config.mc.port : ""} ` +
      `every ${config.pollIntervalMs / 1000}s`,
  );
  const loop = () => {
    void pollOnce().finally(() => {
      timer = setTimeout(loop, config.pollIntervalMs);
    });
  };
  let timer: NodeJS.Timeout;
  loop();
}
