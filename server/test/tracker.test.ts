// Unit tests for the source-reconciliation core.
// Env must be set before the modules load (db opens SQLite at import time).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "gmina-test-")), "test.db");
process.env.MC_HOST = "example.invalid";
process.env.PLUGIN_TIMEOUT_SECONDS = "1"; // fast fallback for the timeout test
process.env.SLP_STALE_SECONDS = "1"; // fast eviction for the capped-sample test

const tracker = await import("../src/tracker.js");
const db = await import("../src/db.js");

const names = () => db.currentlyOnline().map((p) => p.name).sort();

test("slp snapshot opens sessions and marks players online", () => {
  tracker.applySnapshot(
    [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    2,
    "slp",
  );
  assert.equal(tracker.activeSource(), "slp");
  assert.equal(tracker.isServerReachable(), true);
  assert.deepEqual(names(), ["A", "B"]);
  assert.ok(db.roster().every((p) => p.sessionsCount === 1));
});

test("slp departure closes the session", () => {
  tracker.applySnapshot([{ id: "a", name: "A" }], 1, "slp");
  assert.deepEqual(names(), ["A"]);
  const b = db.roster().find((p) => p.name === "B");
  assert.ok(b && !b.online && b.totalPlaytimeMs >= 0);
});

test("plugin heartbeat takes over and conflicting slp snapshots are ignored", () => {
  tracker.applySnapshot(
    [
      { id: "a", name: "A" },
      { id: "c", name: "C" },
    ],
    2,
    "plugin",
  );
  assert.equal(tracker.activeSource(), "plugin");
  // A stale/empty SLP result must not wipe the plugin's state.
  tracker.applySnapshot([], 0, "slp");
  assert.deepEqual(names(), ["A", "C"]);
});

test("plugin events update state instantly without duplicating sessions", () => {
  tracker.applyPluginEvent("quit", { id: "c", name: "C" });
  assert.deepEqual(names(), ["A"]);
  tracker.applyPluginEvent("join", { id: "d", name: "D" });
  tracker.applyPluginEvent("join", { id: "d", name: "D" }); // duplicate join
  assert.deepEqual(names(), ["A", "D"]);
  const d = db.roster().find((p) => p.name === "D");
  assert.equal(d?.sessionsCount, 1);
});

test("silent plugin falls back to slp after the timeout", async () => {
  await sleep(1100);
  assert.equal(tracker.pluginActive(), false);
  assert.equal(tracker.activeSource(), "slp");
  // SLP is authoritative again and reconciles the roster.
  tracker.applySnapshot([{ id: "a", name: "A" }], 1, "slp");
  assert.deepEqual(names(), ["A"]);
});

test("markUnreachable closes every open session", () => {
  tracker.markUnreachable("slp");
  assert.equal(db.currentlyOnline().length, 0);
  assert.equal(tracker.isServerReachable(), false);
  assert.equal(tracker.activeSource(), "none");
  assert.ok(db.roster().every((p) => !p.online));
});

test("capped slp sample does not evict players until they go stale", async () => {
  tracker.applySnapshot(
    [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    2,
    "slp",
  );
  // Sample capped: only A visible, but the server still reports 2 online.
  tracker.applySnapshot([{ id: "a", name: "A" }], 2, "slp");
  assert.deepEqual(names(), ["A", "B"], "B kept — probably just outside the sample");
  // …but once B hasn't shown up in any sample past the staleness window:
  await sleep(1100);
  tracker.applySnapshot([{ id: "a", name: "A" }], 2, "slp");
  assert.deepEqual(names(), ["A"]);
  // A complete snapshot (count matches sample) evicts immediately.
  tracker.applySnapshot([{ id: "b", name: "B" }], 1, "slp");
  assert.deepEqual(names(), ["B"]);
});

test("rejoin within the cooldown suppresses push, later rejoin does not", () => {
  assert.equal(tracker.shouldNotify(null), true, "first-ever join notifies");
  assert.equal(tracker.shouldNotify(Date.now() - 1000), false, "left 1s ago — flap");
  assert.equal(tracker.shouldNotify(Date.now() - 10 * 60 * 1000), true, "left 10 min ago");
});
