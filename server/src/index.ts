import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "./config.js";
import {
  roster,
  currentlyOnline,
  registerDevice,
  removeDevice,
} from "./db.js";
import { startPoller, pollEvents, isServerReachable, type PollEvent } from "./poller.js";
import { shutdownPush } from "./push.js";

const app = express();
app.use(express.json());

// Optional bearer-token auth for every /api route.
function auth(req: Request, res: Response, next: NextFunction): void {
  if (!config.http.apiToken) return next();
  const header = req.header("authorization") || "";
  if (header === `Bearer ${config.http.apiToken}`) return next();
  res.status(401).json({ error: "unauthorized" });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, serverReachable: isServerReachable() });
});

function buildStatus() {
  return {
    serverReachable: isServerReachable(),
    onlineCount: currentlyOnline().length,
    rosterDays: config.rosterDays,
    online: currentlyOnline(),
    roster: roster(),
    updatedAt: Date.now(),
  };
}

app.get("/api/status", auth, (_req, res) => {
  res.json(buildStatus());
});

app.post("/api/devices", auth, (req: Request, res: Response) => {
  const token = String(req.body?.token || "").trim();
  if (!token) {
    res.status(400).json({ error: "missing token" });
    return;
  }
  registerDevice(token);
  res.json({ ok: true });
});

app.delete("/api/devices/:token", auth, (req: Request, res: Response) => {
  removeDevice(req.params.token);
  res.json({ ok: true });
});

const httpServer = createServer(app);

// --- WebSocket for live updates ---
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: "status", data: buildStatus() }));
});

pollEvents.on("event", (e: PollEvent) => {
  const payload = JSON.stringify({ type: "event", event: e, data: buildStatus() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
});

httpServer.listen(config.http.port, () => {
  console.log(`[http] listening on :${config.http.port}`);
  startPoller();
});

function shutdown() {
  console.log("\n[shutdown] closing…");
  shutdownPush();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
