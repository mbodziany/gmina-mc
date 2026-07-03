import "dotenv/config";

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined && value !== "" ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

export const config = {
  mc: {
    host: process.env.MC_HOST?.trim() || "",
    // Undefined lets minecraft-server-util resolve the SRV record / use the default port.
    port: process.env.MC_PORT && process.env.MC_PORT.trim() !== ""
      ? Number(process.env.MC_PORT)
      : undefined,
  },
  pollIntervalMs: num(process.env.POLL_INTERVAL_SECONDS, 20) * 1000,
  offlineGracePolls: num(process.env.OFFLINE_GRACE_POLLS, 3),
  rosterDays: num(process.env.ROSTER_DAYS, 7),
  // How long after the last plugin heartbeat we still trust the plugin before
  // falling back to SLP pinging.
  pluginTimeoutMs: num(process.env.PLUGIN_TIMEOUT_SECONDS, 60) * 1000,
  // Anti-flap: a player who rejoins within this window doesn't trigger
  // another push notification (their session is still recorded).
  pushRejoinCooldownMs: num(process.env.PUSH_REJOIN_COOLDOWN_SECONDS, 300) * 1000,
  // SLP's player sample is capped (~12). When the reported online count
  // exceeds the sample, a missing player may just be outside the sample —
  // only mark them offline after they haven't been seen for this long.
  slpStaleMs: num(process.env.SLP_STALE_SECONDS, 180) * 1000,
  http: {
    port: num(process.env.PORT, 8080),
    apiToken: process.env.API_TOKEN?.trim() || "",
    // Shared secret the in-game plugin uses to push data to /api/ingest/*.
    ingestToken: process.env.INGEST_TOKEN?.trim() || "",
    ingestRateLimitPerMinute: num(process.env.INGEST_RATE_LIMIT_PER_MINUTE, 240),
  },
  dbPath: process.env.DB_PATH?.trim() || "./data/gmina.db",
  apns: {
    key: (process.env.APNS_KEY || "").replace(/\\n/g, "\n").trim(),
    keyId: process.env.APNS_KEY_ID?.trim() || "",
    teamId: process.env.APNS_TEAM_ID?.trim() || "",
    bundleId: process.env.APNS_BUNDLE_ID?.trim() || "",
    production: bool(process.env.APNS_PRODUCTION, false),
  },
};

export function apnsEnabled(): boolean {
  const a = config.apns;
  return Boolean(a.key && a.keyId && a.teamId && a.bundleId);
}

if (!config.mc.host) {
  console.warn(
    "[config] MC_HOST is not set — the poller will not be able to reach any server. " +
      "Copy .env.example to .env and fill it in.",
  );
}
