import { openDatabaseSync } from 'expo-sqlite';

/**
 * Tiny synchronous key/value store on top of expo-sqlite, used for the player's local identity
 * (name, avatar) and per-room session tokens (so a reconnect can restore their seat/hand).
 * Never stores hand contents or anything else game-sensitive -- just enough to rejoin.
 */
let db: ReturnType<typeof openDatabaseSync> | null = null;

function getDb() {
  if (!db) {
    db = openDatabaseSync('uno-local.db');
    db.execSync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
  }
  return db;
}

export function kvGet(key: string): string | null {
  try {
    const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function kvSet(key: string, value: string): void {
  try {
    getDb().runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]);
  } catch {
    // Non-fatal: worst case the player re-enters their name or loses a reconnect token.
  }
}

export function kvDelete(key: string): void {
  try {
    getDb().runSync('DELETE FROM kv WHERE key = ?', [key]);
  } catch {
    // ignore
  }
}

const SESSION_TOKEN_PREFIX = 'session-token:';

export function getSessionToken(roomCode: string): string | null {
  return kvGet(SESSION_TOKEN_PREFIX + roomCode);
}

export function setSessionToken(roomCode: string, token: string): void {
  kvSet(SESSION_TOKEN_PREFIX + roomCode, token);
}

export function getPlayerName(): string | null {
  return kvGet('player:name');
}

export function setPlayerName(name: string): void {
  kvSet('player:name', name);
}

export function getPlayerAvatar(): string | null {
  return kvGet('player:avatar');
}

export function setPlayerAvatar(avatar: string): void {
  kvSet('player:avatar', avatar);
}
