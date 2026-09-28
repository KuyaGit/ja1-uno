import { Card, SuperCardType } from '../cards/types';
import { GameEvent } from '../game-engine/events';
import { GameState } from '../game-engine/state';

export interface EngineError {
  code: string;
  message: string;
}

export interface SuperCardEffect<P = unknown> {
  type: SuperCardType;
  name: string;
  description: string;
  /** How many copies of this card are added to the deck when enabled. */
  copiesInDeck: number;
  target: 'none' | 'otherPlayer' | 'color';
  /** Default: any time on your turn when there's no pending forced draw. */
  canPlay(state: GameState, actorId: string): boolean;
  validate(state: GameState, actorId: string, card: Card, params: P): EngineError | null;
  apply(
    state: GameState,
    actorId: string,
    card: Card,
    params: P
  ): { state: GameState; events: GameEvent[] };
}

export function defaultCanPlay(state: GameState, actorId: string): boolean {
  return state.currentPlayerId === actorId && state.pendingDraw === 0;
}
