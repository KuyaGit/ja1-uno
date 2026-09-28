import { EngineError } from '../effects/super-card-effect';
import { GameState } from '../game-engine/state';
import { getPlayer } from '../players/player-utils';

export function err(code: string, message: string): EngineError {
  return { code, message };
}

export function requireGameActive(state: GameState): EngineError | null {
  if (state.status !== 'PLAYING') return err('GAME_NOT_ACTIVE', 'The game is not currently active.');
  return null;
}

export function requireIsTurn(state: GameState, actorId: string): EngineError | null {
  if (state.currentPlayerId !== actorId) return err('NOT_YOUR_TURN', "It is not this player's turn.");
  return null;
}

export function requireIsHost(state: GameState, actorId: string): EngineError | null {
  const player = getPlayer(state, actorId);
  if (!player?.isHost) return err('NOT_HOST', 'Only the host can perform this action.');
  return null;
}

export function requireOwnsCard(state: GameState, actorId: string, cardId: string): EngineError | null {
  const player = getPlayer(state, actorId);
  if (!player) return err('UNKNOWN_PLAYER', 'Unknown player.');
  if (!player.hand.some((c) => c.id === cardId)) {
    return err('CARD_NOT_OWNED', 'Player does not hold that card.');
  }
  return null;
}
