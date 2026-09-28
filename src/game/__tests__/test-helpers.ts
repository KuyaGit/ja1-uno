import { Card, Color } from '../cards/types';
import { GameState, Player } from '../game-engine/state';
import { defaultSettings, GameSettings } from '../rules/settings';

let cardCounter = 0;
export function makeCard(partial: Partial<Card> & Pick<Card, 'kind'>): Card {
  cardCounter += 1;
  return { id: `t-${cardCounter}`, ...partial };
}

export function numberCard(color: Color, value: number): Card {
  return makeCard({ kind: 'number', color, value });
}

export function actionCard(color: Color, action: 'skip' | 'reverse' | 'draw2'): Card {
  return makeCard({ kind: 'action', color, action });
}

export function wildCard(wild: 'wild' | 'wild4' = 'wild'): Card {
  return makeCard({ kind: 'wild', wild });
}

export function superCard(superType: Card['superType'] = 'SWAP'): Card {
  return makeCard({ kind: 'super', superType });
}

export function makePlayer(partial: Partial<Player> & Pick<Player, 'id'>): Player {
  return {
    name: partial.id,
    avatar: '🙂',
    hand: [],
    connected: true,
    isHost: false,
    ready: true,
    calledUno: false,
    ...partial,
  };
}

export function makeState(
  overrides: Partial<Omit<GameState, 'settings'>> & { players: Player[]; settings?: Partial<GameSettings> }
): GameState {
  const order = overrides.order ?? overrides.players.map((p) => p.id);
  const settings: GameSettings = { ...defaultSettings(), ...(overrides.settings ?? {}) };
  return {
    roomCode: 'ROOM1',
    players: overrides.players,
    order,
    currentPlayerId: overrides.currentPlayerId ?? order[0],
    direction: overrides.direction ?? 1,
    currentColor: overrides.currentColor ?? 'RED',
    discardPile: overrides.discardPile ?? [numberCard('RED', 5)],
    drawPile: overrides.drawPile ?? [numberCard('BLUE', 1), numberCard('GREEN', 2), numberCard('YELLOW', 3)],
    pendingDraw: overrides.pendingDraw ?? 0,
    drawnCardId: overrides.drawnCardId ?? null,
    unoVulnerableId: overrides.unoVulnerableId ?? null,
    status: overrides.status ?? 'PLAYING',
    winnerId: overrides.winnerId ?? null,
    settings,
  };
}
