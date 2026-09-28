import { Card, Color } from '../cards/types';

export type GameEventType =
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'GAME_STARTED'
  | 'TURN_CHANGED'
  | 'CARD_PLAYED'
  | 'CARD_DRAWN'
  | 'COLOR_CHANGED'
  | 'PLAYER_SKIPPED'
  | 'REVERSE_ACTIVATED'
  | 'DRAW_TWO'
  | 'WILD_PLAYED'
  | 'SWAP_ACTIVATED'
  | 'HAND_SWAPPED'
  | 'PLAYER_WON'
  | 'GAME_ENDED'
  | 'UNO_CALLED'
  | 'UNO_CAUGHT'
  | 'PLAYER_DISCONNECTED'
  | 'PLAYER_RECONNECTED';

export interface GameEvent<T extends Record<string, unknown> = Record<string, unknown>> {
  type: GameEventType;
  payload: T;
}

export function event<T extends Record<string, unknown>>(type: GameEventType, payload: T): GameEvent<T> {
  return { type, payload };
}

// --- Typed payload helpers (all public-safe; CARD_DRAWN's card identity is stripped for non-drawers by the view layer) ---

export interface CardPlayedPayload extends Record<string, unknown> {
  playerId: string;
  card: Card;
}

export interface CardDrawnPayload extends Record<string, unknown> {
  playerId: string;
  card?: Card; // only present in the copy delivered to the drawing player
  count: number;
}

export interface ColorChangedPayload extends Record<string, unknown> {
  color: Color;
  by: string;
}

export interface TurnChangedPayload extends Record<string, unknown> {
  playerId: string;
}

export interface SwapPayload extends Record<string, unknown> {
  sourcePlayer: string;
  targetPlayer: string;
}
