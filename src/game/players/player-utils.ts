import { GameState, Player } from '../game-engine/state';

export function getPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function requirePlayer(state: GameState, playerId: string): Player {
  const player = getPlayer(state, playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  return player;
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.removed);
}

export function connectedActivePlayers(state: GameState): Player[] {
  return activePlayers(state).filter((p) => p.connected);
}

export function isHost(state: GameState, playerId: string): boolean {
  const player = getPlayer(state, playerId);
  return !!player?.isHost;
}

export function updatePlayer(
  state: GameState,
  playerId: string,
  update: (player: Player) => Player
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? update(p) : p)),
  };
}
