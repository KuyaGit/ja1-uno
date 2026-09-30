/**
 * Web counterpart to kv-store.ts.
 *
 * expo-sqlite's web backend (alpha) loads its SQLite engine as a WebAssembly module inside a
 * Worker, which currently trips an unreleased Metro bug in the dev server ("Worker chunk not
 * found for: .../worker.ts", https://github.com/expo/expo/pull/50244). Since this app never
 * hosts a game from a browser (see host.web.tsx) and only needs a tiny key/value store for the
 * player's local identity, use localStorage on web instead of pulling expo-sqlite into the web
 * bundle at all.
 */
function readStorage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Non-fatal: worst case the player re-enters their name or loses a reconnect token.
  }
}

function removeStorage(key: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function kvGet(key: string): string | null {
  return readStorage(key);
}

export function kvSet(key: string, value: string): void {
  writeStorage(key, value);
}

export function kvDelete(key: string): void {
  removeStorage(key);
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
