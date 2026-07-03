import { Router, type Request, type Response, type NextFunction } from "express";
import { config } from "./config.js";
import { type PlayerSnapshot } from "./db.js";
import { applySnapshot, applyPluginEvent } from "./tracker.js";

export const ingestRouter = Router();

// Fixed-window rate limit per client IP. One plugin sends ~3 heartbeats/min
// plus a few events, so the default (240/min) only stops abuse and floods.
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const nowTs = Date.now();
  if (hits.size > 1000) {
    for (const [k, v] of hits) if (v.resetAt <= nowTs) hits.delete(k);
  }
  const key = req.ip || "unknown";
  let entry = hits.get(key);
  if (!entry || entry.resetAt <= nowTs) {
    entry = { count: 0, resetAt: nowTs + WINDOW_MS };
    hits.set(key, entry);
  }
  if (++entry.count > config.http.ingestRateLimitPerMinute) {
    res.status(429).json({ error: "rate limited" });
    return;
  }
  next();
}

ingestRouter.use(rateLimit);

/** The in-game plugin authenticates with the shared INGEST_TOKEN. */
function ingestAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.http.ingestToken) {
    res.status(503).json({ error: "ingest disabled: set INGEST_TOKEN to enable the plugin" });
    return;
  }
  const header = req.header("authorization") || "";
  if (header === `Bearer ${config.http.ingestToken}`) return next();
  res.status(401).json({ error: "unauthorized" });
}

function normalizePlayer(p: { uuid?: string; id?: string; name?: string }): PlayerSnapshot | null {
  const name = (p.name || "").trim();
  if (!name) return null;
  const uuid = (p.uuid || p.id || "").trim();
  return { id: uuid || name.toLowerCase(), name };
}

/**
 * Authoritative snapshot from the plugin: the full list of players currently
 * online. Sent periodically as a heartbeat (e.g. every 20 s). This both keeps
 * the plugin marked "active" and reconciles any missed join/quit events.
 */
ingestRouter.post("/heartbeat", ingestAuth, (req: Request, res: Response) => {
  const raw = Array.isArray(req.body?.players) ? req.body.players : [];
  const players = raw
    .map(normalizePlayer)
    .filter((p: PlayerSnapshot | null): p is PlayerSnapshot => p !== null);
  applySnapshot(players, players.length, "plugin");
  res.json({ ok: true, online: players.length });
});

/**
 * Instant single event from the plugin for low-latency push notifications.
 * Optional — the heartbeat alone keeps state correct, but events make
 * "X joined" arrive within a second instead of within a heartbeat interval.
 */
ingestRouter.post("/event", ingestAuth, (req: Request, res: Response) => {
  const type = req.body?.type === "quit" ? "quit" : "join";
  const player = normalizePlayer(req.body || {});
  if (!player) {
    res.status(400).json({ error: "missing player name" });
    return;
  }
  applyPluginEvent(type, player);
  res.json({ ok: true });
});
