import { event } from '../game-engine/events';
import { GameState, Player } from '../game-engine/state';
import { defaultCanPlay, SuperCardEffect } from './super-card-effect';

export interface SwapParams {
  targetPlayerId: string;
}

function findPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export const swapEffect: SuperCardEffect<SwapParams> = {
  type: 'SWAP',
  name: 'Swap Hands',
  description: 'Swap your entire hand with another player.',
  copiesInDeck: 4,
  target: 'otherPlayer',
  canPlay: defaultCanPlay,

  validate(state, actorId, _card, params) {
    const target = params?.targetPlayerId ? findPlayer(state, params.targetPlayerId) : undefined;
    if (!params?.targetPlayerId) {
      return { code: 'MISSING_TARGET', message: 'A target player is required for SWAP.' };
    }
    if (params.targetPlayerId === actorId) {
      return { code: 'INVALID_TARGET', message: 'Cannot target yourself.' };
    }
    if (!target || target.removed) {
      return { code: 'INVALID_TARGET', message: 'Target player does not exist.' };
    }
    if (!target.connected) {
      return { code: 'INVALID_TARGET', message: 'Target player is disconnected.' };
    }
    return null;
  },

  apply(state, actorId, card, params) {
    const actor = findPlayer(state, actorId);
    const target = findPlayer(state, params.targetPlayerId);
    if (!actor || !target) {
      throw new Error('SWAP apply called with invalid players');
    }

    const players = state.players.map((p) => {
      if (p.id === actor.id) {
        return { ...p, hand: target.hand, calledUno: false };
      }
      if (p.id === target.id) {
        return { ...p, hand: actor.hand, calledUno: false };
      }
      return p;
    });

    const nextUnoVulnerable =
      state.unoVulnerableId === actor.id || state.unoVulnerableId === target.id
        ? null
        : state.unoVulnerableId;

    const nextState: GameState = { ...state, players, unoVulnerableId: nextUnoVulnerable };
    const events = [
      event('SWAP_ACTIVATED', { sourcePlayer: actor.id, targetPlayer: target.id, card: card.id }),
      event('HAND_SWAPPED', { sourcePlayer: actor.id, targetPlayer: target.id }),
    ];
    return { state: nextState, events };
  },
};
