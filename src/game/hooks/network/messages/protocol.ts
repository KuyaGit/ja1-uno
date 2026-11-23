import { GameAction } from '@/game/game-engine/actions';
import { GameEvent } from '@/game/game-engine/events';
import { PlayerGameView } from '@/game/game-engine/view';

export const PROTOCOL_VERSION = 1;

// --- Client -> Host ---

export interface HelloMessage {
  type: 'HELLO';
  v: number;
  roomCode: string;
  name: string;
  avatar: string;
  sessionToken?: string;
}

export interface ActionMessage {
  type: 'ACTION';
  action: GameAction;
  /** Client-assigned id echoed back so the client can correlate errors to a specific send. */
  requestId?: string;
}

export interface PingMessage {
  type: 'PING';
}

export type ClientMessage = HelloMessage | ActionMessage | PingMessage;

// --- Host -> Client ---

export interface WelcomeMessage {
  type: 'WELCOME';
  playerId: string;
  sessionToken: string;
}

export interface StateMessage {
  type: 'STATE';
  seq: number;
  view: PlayerGameView;
}

export interface EventsMessage {
  type: 'EVENTS';
  seq: number;
  events: GameEvent[];
}

export interface ErrorMessage {
  type: 'ERROR';
  code: string;
  message: string;
  requestId?: string;
}

export interface KickedMessage {
  type: 'KICKED';
  reason?: string;
}

export interface PongMessage {
  type: 'PONG';
}

export type HostMessage = WelcomeMessage | StateMessage | EventsMessage | ErrorMessage | KickedMessage | PongMessage;
