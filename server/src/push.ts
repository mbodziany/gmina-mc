import apn from "@parse/node-apn";
import { config, apnsEnabled } from "./config.js";
import { allDeviceTokens, removeDevice } from "./db.js";

let provider: apn.Provider | null = null;

function getProvider(): apn.Provider | null {
  if (!apnsEnabled()) return null;
  if (provider) return provider;
  provider = new apn.Provider({
    token: {
      key: config.apns.key,
      keyId: config.apns.keyId,
      teamId: config.apns.teamId,
    },
    production: config.apns.production,
  });
  return provider;
}

/** Sends a "<name> joined the server" push to every registered device. */
export async function notifyJoin(name: string, onlineCount: number): Promise<void> {
  const p = getProvider();
  if (!p) return;
  const tokens = allDeviceTokens();
  if (tokens.length === 0) return;

  const note = new apn.Notification();
  note.topic = config.apns.bundleId;
  note.sound = "default";
  note.alert = {
    title: "Ktoś gra w Minecraft 🎮",
    body: `${name} właśnie dołączył do serwera.`,
  };
  note.payload = { kind: "join", name };
  note.badge = onlineCount;
  note.threadId = "gmina-mc-online";

  try {
    const result = await p.send(note, tokens);
    // Drop tokens Apple reports as invalid so we stop spamming them.
    for (const failed of result.failed) {
      if (Number(failed.status) === 410 || failed.response?.reason === "BadDeviceToken") {
        removeDevice(failed.device);
      }
    }
    if (result.sent.length > 0) {
      console.log(`[push] notified ${result.sent.length} device(s) about ${name}`);
    }
  } catch (err) {
    console.error("[push] failed to send notification:", err);
  }
}

export function shutdownPush(): void {
  provider?.shutdown();
  provider = null;
}
