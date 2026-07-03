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

const lastSeenStmt = db.prepare("SELECT last_seen FROM players WHERE id = ?");
/** When we last saw this player (for an offline player: when they left). */
export function getLastSeen(id: string): number | null {
  const row = lastSeenStmt.get(id) as { last_seen: number } | undefined;
  return row?.last_seen ?? null;
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

const rosterStmt = db.prepare(`
  SELECT
    p.id, p.name, p.first_seen, p.last_seen, p.online,
    COUNT(s.id) AS cnt,
    COALESCE(SUM(COALESCE(s.ended_at, @now) - s.started_at), 0) AS total,
    MAX(CASE WHEN s.ended_at IS NULL THEN s.started_at END) AS open_start
  FROM players p
  LEFT JOIN sessions s ON s.player_id = p.id AND s.started_at >= @since
  WHERE p.last_seen >= @since
  GROUP BY p.id
  ORDER BY p.last_seen DESC
`);

/** Players seen within the roster window, with aggregated stats over that window. */
export function roster(): RosterEntry[] {
  const ts = now();
  const since = ts - config.rosterDays * 24 * 60 * 60 * 1000;
  const rows = rosterStmt.all({ now: ts, since }) as {
    id: string;
    name: string;
    first_seen: number;
    last_seen: number;
    online: number;
    cnt: number;
    total: number;
    open_start: number | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    online: Boolean(r.online),
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    sessionsCount: r.cnt,
    totalPlaytimeMs: r.total,
    currentSessionStart: r.online ? r.open_start : null,
  }));
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
