import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id          TEXT PRIMARY KEY,   -- UUID when available, otherwise lowercased name
    name        TEXT NOT NULL,
    first_seen  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    online      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    started_at  INTEGER NOT NULL,
    ended_at    INTEGER          -- NULL while the session is still open
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

  CREATE TABLE IF NOT EXISTS devices (
    token       TEXT PRIMARY KEY,
    created_at  INTEGER NOT NULL
  );
`);

export interface PlayerSnapshot {
  id: string;
  name: string;
}

export interface RosterEntry {
  id: string;
  name: string;
  online: boolean;
  firstSeen: number;
  lastSeen: number;
  sessionsCount: number;
  totalPlaytimeMs: number;
  currentSessionStart: number | null;
}

const now = () => Date.now();

/** Players the DB currently believes are online. */
export function onlinePlayerIds(): Set<string> {
  const rows = db.prepare("SELECT id FROM players WHERE online = 1").all() as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

const upsertPlayerStmt = db.prepare(`
  INSERT INTO players (id, name, first_seen, last_seen, online)
  VALUES (@id, @name, @ts, @ts, 1)
  ON CONFLICT(id) DO UPDATE SET name = @name, last_seen = @ts, online = 1
`);

const openSessionStmt = db.prepare(`
  INSERT INTO sessions (player_id, name, started_at) VALUES (?, ?, ?)
`);

const markOnlineTx = db.transaction((p: PlayerSnapshot, wasOnline: boolean, ts: number) => {
  upsertPlayerStmt.run({ id: p.id, name: p.name, ts });
  if (!wasOnline) openSessionStmt.run(p.id, p.name, ts);
  return !wasOnline;
});

/** Records a player coming online and opens a new session. Returns true if this is a new arrival. */
export function markOnline(p: PlayerSnapshot, wasOnline: boolean): boolean {
  return markOnlineTx(p, wasOnline, now()) as boolean;
}

const touchStmt = db.prepare("UPDATE players SET last_seen = ? WHERE id = ?");
export function touch(id: string): void {
  touchStmt.run(now(), id);
}

const closeSessionStmt = db.prepare(`
  UPDATE sessions SET ended_at = ?
  WHERE player_id = ? AND ended_at IS NULL
`);
const setOfflineStmt = db.prepare("UPDATE players SET online = 0, last_seen = ? WHERE id = ?");

const markOfflineTx = db.transaction((id: string, ts: number) => {
  closeSessionStmt.run(ts, id);
  setOfflineStmt.run(ts, id);
});

export function markOffline(id: string): void {
  markOfflineTx(id, now());
}

export function markAllOffline(): string[] {
  const ids = [...onlinePlayerIds()];
  for (const id of ids) markOffline(id);
  return ids;
}

export function currentlyOnline(): RosterEntry[] {
  return roster().filter((r) => r.online);
}

/** Players seen within the roster window, with aggregated stats over that window. */
export function roster(): RosterEntry[] {
  const since = now() - config.rosterDays * 24 * 60 * 60 * 1000;
  const players = db
    .prepare("SELECT * FROM players WHERE last_seen >= ? ORDER BY last_seen DESC")
    .all(since) as {
    id: string;
    name: string;
    first_seen: number;
    last_seen: number;
    online: number;
  }[];

  const aggStmt = db.prepare(`
    SELECT
      COUNT(*) AS cnt,
      COALESCE(SUM(COALESCE(ended_at, ?) - started_at), 0) AS total
    FROM sessions
    WHERE player_id = ? AND started_at >= ?
  `);
  const openStmt = db.prepare(`
    SELECT started_at FROM sessions WHERE player_id = ? AND ended_at IS NULL
    ORDER BY started_at DESC LIMIT 1
  `);

  const ts = now();
  return players.map((p) => {
    const agg = aggStmt.get(ts, p.id, since) as { cnt: number; total: number };
    const open = p.online
      ? (openStmt.get(p.id) as { started_at: number } | undefined)
      : undefined;
    return {
      id: p.id,
      name: p.name,
      online: Boolean(p.online),
      firstSeen: p.first_seen,
      lastSeen: p.last_seen,
      sessionsCount: agg.cnt,
      totalPlaytimeMs: agg.total,
      currentSessionStart: open?.started_at ?? null,
    };
  });
}

export function registerDevice(token: string): void {
  db.prepare(
    "INSERT INTO devices (token, created_at) VALUES (?, ?) ON CONFLICT(token) DO NOTHING",
  ).run(token, now());
}

export function removeDevice(token: string): void {
  db.prepare("DELETE FROM devices WHERE token = ?").run(token);
}

export function allDeviceTokens(): string[] {
  return (db.prepare("SELECT token FROM devices").all() as { token: string }[]).map(
    (r) => r.token,
  );
}
