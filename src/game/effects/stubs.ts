import { SuperCardType } from '../cards/types';
import { defaultCanPlay, SuperCardEffect } from './super-card-effect';

/**
 * Placeholder effects for super cards that are registered (so settings UI and deck-building
 * can reference them) but not enabled by default. Their `apply` throws — this is safe because
 * `enabledSuperCards` defaults to `['SWAP']` only, and the engine only ever invokes `apply` for
 * a card that actually exists in the deck, which only happens if a room enables the type.
 */
function makeStub(type: SuperCardType, name: string, description: string): SuperCardEffect {
  return {
    type,
    name,
    description,
    copiesInDeck: 2,
    target: 'none',
    canPlay: defaultCanPlay,
    validate() {
      return { code: 'NOT_IMPLEMENTED', message: `${name} is not implemented yet.` };
    },
    apply() {
      throw new Error(`Super card effect "${type}" is not implemented.`);
    },
  };
}

export const stealEffect = makeStub('STEAL', 'Steal', 'Steal a random card from another player.');
export const shieldEffect = makeStub('SHIELD', 'Shield', 'Block the next action card played against you.');
export const doubleTurnEffect = makeStub('DOUBLE_TURN', 'Double Turn', 'Take an extra turn.');
export const reverseAllEffect = makeStub('REVERSE_ALL', 'Reverse All', 'Reverse turn order and skip the next player.');
export const discardAllEffect = makeStub('DISCARD_ALL', 'Discard All', 'Discard all cards of one color from your hand.');
export const tradeEffect = makeStub('TRADE', 'Trade', 'Trade one chosen card with another player.');
