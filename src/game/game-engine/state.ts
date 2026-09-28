import { Card, Color } from '../cards/types';
import { GameSettings } from '../rules/settings';

export type GameStatus = 'LOBBY' | 'PLAYING' | 'ENDED';
export type Direction = 1 | -1;

export interface Player {
  id: string;
  name: string;
  avatar: string;
  hand: Card[];
  connected: boolean;
  isHost: boolean;
  ready: boolean;
  calledUno: boolean;
  /** Removed players are kept for history but excluded from turn order. */
  removed?: boolean;
}

export interface GameState {
  roomCode: string;
  players: Player[];
  /** Player ids in seating order. */
  order: string[];
  currentPlayerId: string | null;
  direction: Direction;
  currentColor: Color | null;
  discardPile: Card[];
  drawPile: Card[];
  /** Accumulated forced draw count for the current player (draw2/draw4 stacking). */
  pendingDraw: number;
  /** Set once the current player has drawn this turn but not yet played/passed. */
  drawnCardId: string | null;
  /** Player id who is at exactly 1 card and hasn't called UNO yet, vulnerable to being caught. */
  unoVulnerableId: string | null;
  status: GameStatus;
  winnerId: string | null;
  settings: GameSettings;
}

export function createEmptyState(roomCode: string, settings: GameSettings): GameState {
  return {
    roomCode,
    players: [],
    order: [],
    currentPlayerId: null,
    direction: 1,
    currentColor: null,
    discardPile: [],
    drawPile: [],
    pendingDraw: 0,
    drawnCardId: null,
    unoVulnerableId: null,
    status: 'LOBBY',
    winnerId: null,
    settings,
  };
}
