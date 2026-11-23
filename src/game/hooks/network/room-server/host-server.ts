import { GameAction } from '@/game/game-engine/actions';
import { GameEvent } from '@/game/game-engine/events';
import { applyAction, createRoom, joinRoom, setConnectionStatus } from '@/game/game-engine/engine';
import { GameState } from '@/game/game-engine/state';
import { redactEventsForPlayer, toPlayerView } from '@/game/game-engine/view';
import { Rng } from '@/game/deck/shuffle';
import { decodeClientMessage, encodeMessage } from '../messages/codec';
import { ClientMessage, PROTOCOL_VERSION } from '../messages/protocol';
import { attachWebSocketServer, WSConnection } from '../websocket/ws-server';
import { RawServer } from '../websocket/raw-socket';
import { SessionManager } from './session-manager';

const HELLO_TIMEOUT_MS = 10_000;
const TURN_TIMEOUT_MS = 15_000;
const HEARTBEAT_SWEEP_MS = 5_000;
const SOCKET_SILENCE_TIMEOUT_MS = 15_000;

export interface HostServerOptions {
  roomCode: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  /** Injectable RNG, primarily for deterministic tests. */
  rng?: Rng;
  /** Injectable id/token generator, primarily for deterministic tests. */
  generateId?: () => string;
  now?: () => number;
  /** Session token the host's own client connects with to bind to the pre-seated host player. */
  hostSessionToken?: string;
}

interface ConnectionRecord {
  conn: WSConnection;
  playerId: string | null;
  lastSeenAt: number;
}

/**
 * The authoritative single-room game server. Owns the canonical `GameState`, applies actions
 * one at a time (JS's single-threaded event loop is what actually guarantees serialization --
 * every `applyAction` call here is fully synchronous), and broadcasts a redacted `STATE` +
 * `EVENTS` pair to every connected player after each successful action.
 */
export class HostServer {
  private state: GameState;
  private sessions = new SessionManager();
  private connections = new Map<WSConnection, ConnectionRecord>();
  private seq = 0;
  private rng: Rng;
  private generateId: () => string;
  private now: () => number;
  private turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly hostId: string;
  private readonly hostSessionToken: string;
  private stopped = false;

  constructor(options: HostServerOptions) {
    this.hostId = options.hostId;
    this.state = createRoom(options.roomCode, options.hostId, options.hostName, options.hostAvatar);
    this.rng = options.rng ?? Math.random;
    this.generateId = options.generateId ?? defaultGenerateId;
    this.now = options.now ?? (() => Date.now());
    this.hostSessionToken = options.hostSessionToken ?? defaultGenerateId();
    this.sessions.register(this.hostSessionToken, this.hostId);
  }

  getState(): GameState {
    return this.state;
  }

  /** The session token the host's own local client should HELLO with to claim the host seat. */
  getHostSessionToken(): string {
    return this.hostSessionToken;
  }

  attach(rawServer: RawServer): void {
    attachWebSocketServer(rawServer, { onConnection: (conn) => this.handleConnection(conn) });
  }

  start(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => this.sweepStaleConnections(), HEARTBEAT_SWEEP_MS);
  }

  stop(): void {
    // Flag first: closing each connection fires handleDisconnect, which must not schedule new
    // turn timers (or broadcast) for a room that is going away.
    this.stopped = true;
    for (const record of Array.from(this.connections.values())) {
      try {
        record.conn.close(1001, 'Host closed the room');
      } catch {
        // ignore
      }
    }
    this.connections.clear();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const timer of this.turnTimers.values()) clearTimeout(timer);
    this.turnTimers.clear();
  }

  private handleConnection(conn: WSConnection): void {
    const record: ConnectionRecord = { conn, playerId: null, lastSeenAt: this.now() };
    this.connections.set(conn, record);

    const helloTimer = setTimeout(() => {
      if (!record.playerId) conn.close(4000, 'HELLO timeout');
    }, HELLO_TIMEOUT_MS);

    conn.onMessage((raw) => {
      record.lastSeenAt = this.now();
      clearTimeout(helloTimer);
      this.handleMessage(record, raw);
    });

    conn.onClose(() => {
      clearTimeout(helloTimer);
      this.handleDisconnect(record);
    });
  }

  private handleMessage(record: ConnectionRecord, raw: string): void {
    const msg = decodeClientMessage(raw);
    if (!msg) return;

    if (msg.type === 'PING') {
      record.conn.send(encodeMessage({ type: 'PONG' }));
      return;
    }

    if (msg.type === 'HELLO') {
      this.handleHello(record, msg);
      return;
    }

    if (msg.type === 'ACTION') {
      this.handleAction(record, msg);
      return;
    }
  }

  private handleHello(record: ConnectionRecord, msg: Extract<ClientMessage, { type: 'HELLO' }>): void {
    if (msg.roomCode !== this.state.roomCode) {
      record.conn.send(encodeMessage({ type: 'ERROR', code: 'WRONG_ROOM', message: 'Room code does not match.' }));
      record.conn.close(4001, 'Wrong room code');
      return;
    }
    if (msg.v !== PROTOCOL_VERSION) {
      record.conn.send(
        encodeMessage({ type: 'ERROR', code: 'PROTOCOL_MISMATCH', message: 'Client/host protocol version mismatch.' })
      );
      record.conn.close(4002, 'Protocol mismatch');
      return;
    }

    // Reconnect path: known session token rebinds to the existing player.
    if (msg.sessionToken) {
      const existingPlayerId = this.sessions.resolve(msg.sessionToken);
      const player = existingPlayerId ? this.state.players.find((p) => p.id === existingPlayerId) : undefined;
      if (existingPlayerId && player && !player.removed) {
        record.playerId = existingPlayerId;
        this.applyConnectionStatus(existingPlayerId, true);
        record.conn.send(encodeMessage({ type: 'WELCOME', playerId: existingPlayerId, sessionToken: msg.sessionToken }));
        this.clearTurnTimer(existingPlayerId);
        this.broadcastState();
        return;
      }
      // Unknown/stale token falls through to a fresh join below.
    }

    if (this.state.status !== 'LOBBY') {
      record.conn.send(
        encodeMessage({ type: 'ERROR', code: 'GAME_IN_PROGRESS', message: 'Cannot join: game already in progress.' })
      );
      record.conn.close(4003, 'Game in progress');
      return;
    }

    const playerId = this.generateId();
    const result = joinRoom(this.state, playerId, msg.name, msg.avatar);
    if (!result.ok) {
      record.conn.send(encodeMessage({ type: 'ERROR', code: result.error.code, message: result.error.message }));
      record.conn.close(4004, result.error.code);
      return;
    }

    this.state = result.state;
    const token = this.generateId();
    this.sessions.register(token, playerId);
    record.playerId = playerId;

    record.conn.send(encodeMessage({ type: 'WELCOME', playerId, sessionToken: token }));
    this.broadcastState(result.events);
  }

  private handleAction(record: ConnectionRecord, msg: Extract<ClientMessage, { type: 'ACTION' }>): void {
    if (!record.playerId) {
      record.conn.send(encodeMessage({ type: 'ERROR', code: 'NOT_JOINED', message: 'Send HELLO first.' }));
      return;
    }
    const action = msg.action as GameAction;
    const result = applyAction(this.state, record.playerId, action, this.rng);
    if (!result.ok) {
      record.conn.send(
        encodeMessage({ type: 'ERROR', code: result.error.code, message: result.error.message, requestId: msg.requestId })
      );
      return;
    }
    this.state = result.state;
    this.rescheduleTurnTimer();
    this.broadcastState(result.events);
  }

  private handleDisconnect(record: ConnectionRecord): void {
    this.connections.delete(record.conn);
    if (this.stopped || !record.playerId) return;
    if (!this.state.players.find((p) => p.id === record.playerId && !p.removed)) return;
    this.applyConnectionStatus(record.playerId, false);
    this.rescheduleTurnTimer();
    this.broadcastState();
  }

  private applyConnectionStatus(playerId: string, connected: boolean): void {
    const result = setConnectionStatus(this.state, playerId, connected);
    if (result.ok) {
      this.state = result.state;
      this.broadcastEventsOnly(result.events);
    }
  }

  /** Ensures exactly one pending SKIP_TURN_TIMEOUT is scheduled for a disconnected current player. */
  private rescheduleTurnTimer(): void {
    if (this.stopped) return;
    for (const [playerId, timer] of this.turnTimers) {
      if (playerId !== this.state.currentPlayerId) {
        clearTimeout(timer);
        this.turnTimers.delete(playerId);
      }
    }
    const current = this.state.players.find((p) => p.id === this.state.currentPlayerId);
    if (
      this.state.status === 'PLAYING' &&
      current &&
      !current.connected &&
      !this.turnTimers.has(current.id)
    ) {
      const timer = setTimeout(() => this.autoSkipTurn(current.id), TURN_TIMEOUT_MS);
      this.turnTimers.set(current.id, timer);
    }
  }

  private clearTurnTimer(playerId: string): void {
    const timer = this.turnTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(playerId);
    }
  }

  private autoSkipTurn(playerId: string): void {
    this.turnTimers.delete(playerId);
    if (this.stopped) return;
    if (this.state.currentPlayerId !== playerId || this.state.status !== 'PLAYING') return;
    const result = applyAction(this.state, this.hostId, { type: 'SKIP_TURN_TIMEOUT', playerId }, this.rng);
    if (result.ok) {
      this.state = result.state;
      this.rescheduleTurnTimer();
      this.broadcastState(result.events);
    }
  }

  /** Host-issued removal of a disconnected player (e.g. via a [REMOVE PLAYER] UI action). */
  removePlayer(targetId: string): void {
    const result = applyAction(this.state, this.hostId, { type: 'REMOVE_PLAYER', targetId }, this.rng);
    if (result.ok) {
      this.state = result.state;
      this.clearTurnTimer(targetId);
      this.rescheduleTurnTimer();
      this.broadcastState(result.events);
    }
  }

  private sweepStaleConnections(): void {
    const now = this.now();
    for (const record of Array.from(this.connections.values())) {
      if (now - record.lastSeenAt > SOCKET_SILENCE_TIMEOUT_MS) {
        try {
          record.conn.close(4008, 'Silence timeout');
        } catch {
          // ignore
        }
      }
    }
  }

  private broadcastState(events: GameEvent[] = []): void {
    this.seq += 1;
    const seq = this.seq;
    for (const record of this.connections.values()) {
      if (!record.playerId) continue;
      const view = toPlayerView(this.state, record.playerId);
      record.conn.send(encodeMessage({ type: 'STATE', seq, view }));
      if (events.length > 0) {
        record.conn.send(
          encodeMessage({ type: 'EVENTS', seq, events: redactEventsForPlayer(events, record.playerId) })
        );
      }
    }
  }

  private broadcastEventsOnly(events: GameEvent[]): void {
    this.seq += 1;
    const seq = this.seq;
    for (const record of this.connections.values()) {
      if (!record.playerId) continue;
      record.conn.send(encodeMessage({ type: 'EVENTS', seq, events: redactEventsForPlayer(events, record.playerId) }));
    }
  }
}

function defaultGenerateId(): string {
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
