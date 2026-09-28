import { GameAction } from '@/game/game-engine/actions';
import { GameEvent } from '@/game/game-engine/events';
import { PlayerGameView } from '@/game/game-engine/view';
import { decodeHostMessage, encodeMessage } from '../messages/codec';
import { PROTOCOL_VERSION } from '../messages/protocol';
import { ClientTransport } from './transport';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface GameClientEvents {
  onStatusChange(status: ConnectionStatus): void;
  onState(view: PlayerGameView): void;
  onEvents(events: GameEvent[]): void;
  onError(code: string, message: string, requestId?: string): void;
  onKicked(reason?: string): void;
}

export interface GameClientOptions {
  roomCode: string;
  name: string;
  avatar: string;
  getSessionToken: () => string | null;
  setSessionToken: (token: string) => void;
  createTransport: () => ClientTransport;
  listeners: Partial<GameClientEvents>;
  /** Max reconnect attempts before giving up and calling onStatusChange('disconnected'). Default: retry ~30s. */
  reconnectBudgetMs?: number;
  pingIntervalMs?: number;
}

const DEFAULT_RECONNECT_BUDGET_MS = 30_000;
const DEFAULT_PING_INTERVAL_MS = 5_000;

/**
 * Client-side connection to a `HostServer`: connects, sends HELLO, relays engine actions, and
 * auto-reconnects with exponential backoff (bounded by `reconnectBudgetMs`) if the connection
 * drops mid-game, restoring the player's seat via the stored session token.
 */
export class GameClient {
  private options: GameClientOptions;
  private transport: ClientTransport | null = null;
  private status: ConnectionStatus = 'idle';
  private reconnectAttempt = 0;
  private reconnectDeadline: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private manuallyClosed = false;
  public playerId: string | null = null;

  constructor(options: GameClientOptions) {
    this.options = options;
  }

  connect(): void {
    this.manuallyClosed = false;
    this.reconnectAttempt = 0;
    this.reconnectDeadline = null;
    this.openSocket('connecting');
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.clearPingInterval();
    this.transport?.close();
    this.transport = null;
    this.setStatus('disconnected');
  }

  send(action: GameAction, requestId?: string): void {
    if (!this.transport || this.status !== 'connected') return;
    this.transport.send(encodeMessage({ type: 'ACTION', action, requestId }));
  }

  private openSocket(status: ConnectionStatus): void {
    this.setStatus(status);
    const transport = this.options.createTransport();
    this.transport = transport;

    transport.connect({
      onOpen: () => {
        const sessionToken = this.options.getSessionToken() ?? undefined;
        transport.send(
          encodeMessage({
            type: 'HELLO',
            v: PROTOCOL_VERSION,
            roomCode: this.options.roomCode,
            name: this.options.name,
            avatar: this.options.avatar,
            sessionToken,
          })
        );
      },
      onMessage: (raw) => this.handleMessage(raw),
      onClose: () => this.handleClose(),
      onError: () => {
        // onClose typically follows; nothing extra needed here.
      },
    });
  }

  private handleMessage(raw: string): void {
    const msg = decodeHostMessage(raw);
    if (!msg) return;

    switch (msg.type) {
      case 'WELCOME':
        this.playerId = msg.playerId;
        this.options.setSessionToken(msg.sessionToken);
        this.reconnectAttempt = 0;
        this.reconnectDeadline = null;
        this.setStatus('connected');
        this.startPingInterval();
        break;
      case 'STATE':
        this.options.listeners.onState?.(msg.view);
        break;
      case 'EVENTS':
        this.options.listeners.onEvents?.(msg.events);
        break;
      case 'ERROR':
        this.options.listeners.onError?.(msg.code, msg.message, msg.requestId);
        break;
      case 'KICKED':
        this.options.listeners.onKicked?.(msg.reason);
        this.disconnect();
        break;
      case 'PONG':
        break;
    }
  }

  private handleClose(): void {
    this.clearPingInterval();
    if (this.manuallyClosed) return;

    if (this.reconnectDeadline === null) {
      this.reconnectDeadline = Date.now() + (this.options.reconnectBudgetMs ?? DEFAULT_RECONNECT_BUDGET_MS);
    }
    if (Date.now() >= this.reconnectDeadline) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('reconnecting');
    const delay = Math.min(500 * 2 ** this.reconnectAttempt, 5000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.openSocket('reconnecting'), delay);
  }

  private startPingInterval(): void {
    this.clearPingInterval();
    const interval = this.options.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
    this.pingInterval = setInterval(() => {
      this.transport?.send(encodeMessage({ type: 'PING' }));
    }, interval);
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.options.listeners.onStatusChange?.(status);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Mutable listener bag -- used by `ClientStore` to wire itself up after construction. */
  get listeners(): Partial<GameClientEvents> {
    return this.options.listeners;
  }
}
