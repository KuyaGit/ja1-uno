import { Direction, GameState } from '../game-engine/state';

/**
 * Returns the next player id in `direction` starting from `fromPlayerId`, walking `state.order`
 * and skipping players that are removed. Set `skipDisconnected` to also skip players who are
 * currently disconnected (used when auto-advancing past a timed-out player).
 */
export function nextPlayerId(
  state: GameState,
  fromPlayerId: string,
  direction: Direction,
  opts: { skipDisconnected?: boolean } = {}
): string | null {
  const { order, players } = state;
  if (order.length === 0) return null;

  const isEligible = (id: string): boolean => {
    const player = players.find((p) => p.id === id);
    if (!player || player.removed) return false;
    if (opts.skipDisconnected && !player.connected) return false;
    return true;
  };

  const startIdx = order.indexOf(fromPlayerId);
  if (startIdx === -1) {
    // fromPlayerId is gone (e.g. removed); just find the first eligible player.
    const found = order.find(isEligible);
    return found ?? null;
  }

  for (let step = 1; step <= order.length; step++) {
    const idx = (startIdx + direction * step + order.length * order.length) % order.length;
    const candidate = order[idx];
    if (isEligible(candidate)) return candidate;
  }
  return null;
}

export function countActiveEligiblePlayers(state: GameState): number {
  return state.players.filter((p) => !p.removed).length;
}

export function reverseDirection(direction: Direction): Direction {
  return direction === 1 ? -1 : 1;
}
