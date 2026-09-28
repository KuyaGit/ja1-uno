import { ClientMessage, HostMessage } from './protocol';

/** Parses and minimally validates a raw wire string as a `ClientMessage`. Never throws. */
export function decodeClientMessage(raw: string): ClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.type !== 'string') return null;

  switch (parsed.type) {
    case 'HELLO':
      if (
        typeof parsed.v === 'number' &&
        typeof parsed.roomCode === 'string' &&
        typeof parsed.name === 'string' &&
        typeof parsed.avatar === 'string' &&
        (parsed.sessionToken === undefined || typeof parsed.sessionToken === 'string')
      ) {
        return parsed as unknown as ClientMessage;
      }
      return null;
    case 'ACTION':
      if (isRecord(parsed.action) && typeof parsed.action.type === 'string') {
        return parsed as unknown as ClientMessage;
      }
      return null;
    case 'PING':
      return { type: 'PING' };
    default:
      return null;
  }
}

/** Parses and minimally validates a raw wire string as a `HostMessage`. Never throws. */
export function decodeHostMessage(raw: string): HostMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.type !== 'string') return null;

  switch (parsed.type) {
    case 'WELCOME':
    case 'STATE':
    case 'EVENTS':
    case 'ERROR':
    case 'KICKED':
    case 'PONG':
      return parsed as unknown as HostMessage;
    default:
      return null;
  }
}

export function encodeMessage(message: ClientMessage | HostMessage): string {
  return JSON.stringify(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
