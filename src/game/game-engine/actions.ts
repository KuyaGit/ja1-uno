import { Color } from '../cards/types';
import { GameSettings } from '../rules/settings';

export interface PlayCardAction {
  type: 'PLAY_CARD';
  cardId: string;
  chosenColor?: Color;
}

export interface UseSuperCardAction {
  type: 'USE_SUPER_CARD';
  cardId: string;
  targetPlayerId?: string;
  params?: Record<string, unknown>;
}

export interface DrawCardAction {
  type: 'DRAW_CARD';
}

export interface PassAction {
  type: 'PASS';
}

export interface CallUnoAction {
  type: 'CALL_UNO';
}

export interface CatchUnoAction {
  type: 'CATCH_UNO';
  targetId: string;
}

export interface StartGameAction {
  type: 'START_GAME';
}

export interface SetReadyAction {
  type: 'SET_READY';
  ready: boolean;
}

export interface UpdateSettingsAction {
  type: 'UPDATE_SETTINGS';
  settings: Partial<GameSettings>;
}

export interface KickAction {
  type: 'KICK';
  targetId: string;
}

export interface RestartAction {
  type: 'RESTART';
}

export interface EndGameAction {
  type: 'END_GAME';
}

export interface SkipTurnTimeoutAction {
  type: 'SKIP_TURN_TIMEOUT';
  playerId: string;
}

export interface RemovePlayerAction {
  type: 'REMOVE_PLAYER';
  targetId: string;
}

export type GameAction =
  | PlayCardAction
  | UseSuperCardAction
  | DrawCardAction
  | PassAction
  | CallUnoAction
  | CatchUnoAction
  | StartGameAction
  | SetReadyAction
  | UpdateSettingsAction
  | KickAction
  | RestartAction
  | EndGameAction
  | SkipTurnTimeoutAction
  | RemovePlayerAction;

export const HOST_ONLY_ACTION_TYPES: GameAction['type'][] = [
  'UPDATE_SETTINGS',
  'KICK',
  'RESTART',
  'END_GAME',
  'SKIP_TURN_TIMEOUT',
  'REMOVE_PLAYER',
];

export const SYSTEM_ONLY_ACTION_TYPES: GameAction['type'][] = ['SKIP_TURN_TIMEOUT', 'REMOVE_PLAYER'];
