import { EventEmitter } from "node:events";
import { config } from "./config.js";
import {
  markOnline,
  markOffline,
  markAllOffline,
  touch,
  getLastSeen,
  onlinePlayerIds,
  type PlayerSnapshot,
} from "./db.js";
import { notifyJoin } from "./push.js";

export type Source = "plugin" | "slp" | "none";

export interface TrackerEvent {
  type: "join" | "leave" | "server-up" | "server-down" | "tick";
  name?: string;
  onlineCount: number;
  source: Source;
}

/** Emits TrackerEvent so the API/WebSocket layer can push live updates. */
export const trackerEvents = new EventEmitter();

let lastPluginAt = 0;
let serverReachable = false;

/** True while the in-game plugin keeps sending heartbeats. */
export function pluginActive(): boolean {
  return Date.now() - lastPluginAt < config.pluginTimeoutMs;
}

/** Which source is currently authoritative. Plugin wins over SLP. */
export function activeSource(): Source {
  if (pluginActive()) return "plugin";
  return serverReachable ? "slp" : "none";
}

export function isServerReachable(): boolean {
  return pluginActive() || serverReachable;
}

function emit(e: TrackerEvent) {
  trackerEvents.emit("event", e);
}

/**
 * Anti-flap: suppress the push notification when a player rejoins shortly
 * after leaving (unstable connection). The session is still recorded and
 * live events still fire — only the notification is skipped.
 * `previousLastSeen` is the player's last_seen from before this join, i.e.
 * for an offline player the moment they left.
 */
export function shouldNotify(previousLastSeen: number | null): boolean {
  if (previousLastSeen === null) return true; // first time we see this player
  return Date.now() - previousLastSeen >= config.pushRejoinCooldownMs;
}

/**
 * Reconciles the authoritative online list from a source with the DB:
 * opens/closes sessions, fires push on arrivals, emits live events.
 * SLP snapshots are ignored while the plugin is active (plugin is more accurate).
 */
export function applySnapshot(
  players: PlayerSnapshot[],
  onlineCount: number,
  source: "plugin" | "slp",
): void {
  if (source === "slp" && pluginActive()) return; // plugin wins
  if (source === "plugin") lastPluginAt = Date.now();

  if (!serverReachable) {
    serverReachable = true;
    emit({ type: "server-up", onlineCount, source });
  }

  const previouslyOnline = onlinePlayerIds();
  const currentIds = new Set(players.map((p) => p.id));
  // SLP caps the player sample (~12): when the reported count exceeds what we
  // received, a player missing from the sample may still be online.
  const complete = source === "plugin" || players.length >= onlineCount;

  for (const p of players) {
    const wasOnline = previouslyOnline.has(p.id);
    const prevSeen = wasOnline ? null : getLastSeen(p.id);
    const isNew = markOnline(p, wasOnline);
    if (isNew) {
      console.log(`[${source}] ${p.name} joined (online: ${onlineCount})`);
      emit({ type: "join", name: p.name, onlineCount, source });
      if (shouldNotify(prevSeen)) {
        void notifyJoin(p.name, onlineCount);
      } else {
        console.log(`[push] skipping notification for ${p.name} (rejoined within cooldown)`);
      }
    } else {
      touch(p.id);
    }
  }

  for (const id of previouslyOnline) {
    if (currentIds.has(id)) continue;
    if (!complete) {
      // Might just be outside the capped sample — evict only after they
      // haven't shown up in any sample for a while.
      const seen = getLastSeen(id);
      if (seen !== null && Date.now() - seen < config.slpStaleMs) continue;
    }
    markOffline(id);
    console.log(`[${source}] player ${id} left (online: ${onlineCount})`);
    emit({ type: "leave", onlineCount, source });
  }

  emit({ type: "tick", onlineCount, source });
}

/** A single player event reported instantly by the plugin (low-latency push). */
export function applyPluginEvent(type: "join" | "quit", player: PlayerSnapshot): void {
  lastPluginAt = Date.now();
  if (!serverReachable) {
    serverReachable = true;
    emit({ type: "server-up", onlineCount: onlinePlayerIds().size, source: "plugin" });
  }
  const previouslyOnline = onlinePlayerIds();

  if (type === "join") {
    const wasOnline = previouslyOnline.has(player.id);
    const prevSeen = wasOnline ? null : getLastSeen(player.id);
    const isNew = markOnline(player, wasOnline);
    const count = onlinePlayerIds().size;
    if (isNew) {
      console.log(`[plugin] ${player.name} joined (event)`);
      emit({ type: "join", name: player.name, onlineCount: count, source: "plugin" });
      if (shouldNotify(prevSeen)) {
        void notifyJoin(player.name, count);
      } else {
        console.log(`[push] skipping notification for ${player.name} (rejoined within cooldown)`);
      }
    }
  } else {
    if (previouslyOnline.has(player.id)) {
      markOffline(player.id);
      const count = onlinePlayerIds().size;
      console.log(`[plugin] ${player.name} left (event)`);
      emit({ type: "leave", onlineCount: count, source: "plugin" });
    }
  }
}

/** Called when the current source can no longer confirm the server is up. */
export function markUnreachable(source: Source): void {
  if (pluginActive()) return; // plugin still reporting; other failures are irrelevant
  if (serverReachable) {
    serverReachable = false;
    markAllOffline();
    emit({ type: "server-down", onlineCount: 0, source });
    console.warn(`[${source}] server unreachable; everyone marked offline`);
  }
}

/**
 * Safety net for the plugin-only setup (MC_HOST empty, SLP disabled): when
 * heartbeats stop and no poller exists to notice, this closes sessions so
 * players don't stay "online" forever. With SLP enabled the poller owns
 * fallback detection and this stays out of the way.
 */
export function startWatchdog(slpEnabled: boolean): void {
  setInterval(() => {
    if (pluginActive() || slpEnabled) return;
    markUnreachable("none");
  }, 10_000).unref();
}
