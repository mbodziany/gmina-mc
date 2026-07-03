import { status } from "minecraft-server-util";
import { config } from "./config.js";
import { type PlayerSnapshot } from "./db.js";
import { applySnapshot, markUnreachable, pluginActive } from "./tracker.js";

let consecutiveFailures = 0;

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
  // Plugin is the primary source — only ping when it isn't reporting.
  if (pluginActive()) {
    consecutiveFailures = 0; // start fresh if we ever have to take over
    return;
  }

  try {
    const res = await status(config.mc.host, config.mc.port, { timeout: 5000 });
    consecutiveFailures = 0;
    applySnapshot(normalizeSample(res.players.sample), res.players.online, "slp");
  } catch {
    consecutiveFailures++;
    if (consecutiveFailures >= config.offlineGracePolls) {
      markUnreachable("slp");
    }
  }
}

export function startPoller(): void {
  if (!config.mc.host) {
    console.error("[poll] MC_HOST is empty — SLP fallback disabled.");
    return;
  }
  console.log(
    `[poll] SLP fallback monitoring ${config.mc.host}${config.mc.port ? ":" + config.mc.port : ""} ` +
      `every ${config.pollIntervalMs / 1000}s (used only when the plugin is silent)`,
  );
  const loop = () => {
    void pollOnce().finally(() => {
      timer = setTimeout(loop, config.pollIntervalMs);
    });
  };
  let timer: NodeJS.Timeout;
  loop();
}
