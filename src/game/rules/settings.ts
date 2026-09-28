import { SuperCardType } from '../cards/types';

export interface GameSettings {
  /** Which super card types are included in the deck. */
  enabledSuperCards: SuperCardType[];
  /** Draw 2 / Wild Draw 4 accumulate into pendingDraw instead of resolving immediately. */
  stackingDraws: boolean;
  /** Number of cards each player is dealt at game start. */
  startingHandSize: number;
  /** Max players allowed in a room. */
  maxPlayers: number;
}

export const ALL_SUPER_CARD_TYPES: SuperCardType[] = [
  'SWAP',
  'STEAL',
  'SHIELD',
  'DOUBLE_TURN',
  'REVERSE_ALL',
  'DISCARD_ALL',
  'TRADE',
];

/** Only SWAP ships enabled by default; the rest are registered but opt-in. */
export const DEFAULT_ENABLED_SUPER_CARDS: SuperCardType[] = ['SWAP'];

export function defaultSettings(): GameSettings {
  return {
    enabledSuperCards: [...DEFAULT_ENABLED_SUPER_CARDS],
    stackingDraws: false,
    startingHandSize: 7,
    maxPlayers: 6,
  };
}
