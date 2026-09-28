import { Card } from '../cards/types';
import { GameEvent } from './events';
import { GameState } from './state';

export interface PublicPlayerView {
  id: string;
  name: string;
  avatar: string;
  handCount: number;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
  calledUno: boolean;
  removed: boolean;
}

export interface PlayerGameView {
  roomCode: string;
  players: PublicPlayerView[];
  order: string[];
  currentPlayerId: string | null;
  direction: 1 | -1;
  currentColor: GameState['currentColor'];
  discardTop: Card | null;
  drawPileCount: number;
  pendingDraw: number;
  unoVulnerableId: string | null;
  status: GameState['status'];
  winnerId: string | null;
  settings: GameState['settings'];
  /** The requesting player's own hand — full card data. Empty for spectators/unknown ids. */
  yourHand: Card[];
  /** Only set the turn a player just drew a card themselves; hides identity from everyone else. */
  yourDrawnCardId: string | null;
}

/** Redacts other players' hands to counts only, and hides draw pile contents. */
export function toPlayerView(state: GameState, playerId: string): PlayerGameView {
  const self = state.players.find((p) => p.id === playerId);

  return {
    roomCode: state.roomCode,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      handCount: p.hand.length,
      connected: p.connected,
      isHost: p.isHost,
      ready: p.ready,
      calledUno: p.calledUno,
      removed: !!p.removed,
    })),
    order: state.order,
    currentPlayerId: state.currentPlayerId,
    direction: state.direction,
    currentColor: state.currentColor,
    discardTop: state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null,
    drawPileCount: state.drawPile.length,
    pendingDraw: state.pendingDraw,
    unoVulnerableId: state.unoVulnerableId,
    status: state.status,
    winnerId: state.winnerId,
    settings: state.settings,
    yourHand: self ? self.hand.slice() : [],
    // Only the current player can have an in-progress drawn card; hide it from everyone else.
    yourDrawnCardId: state.currentPlayerId === playerId ? state.drawnCardId : null,
  };
}

/**
 * Redacts a batch of engine events for delivery to a specific player. Every event type carries
 * only public data already, except CARD_DRAWN -- whose `card` field must only reach the player
 * who actually drew it.
 */
export function redactEventsForPlayer(events: GameEvent[], playerId: string): GameEvent[] {
  return events.map((e) => {
    if (e.type === 'CARD_DRAWN' && e.payload.playerId !== playerId && 'card' in e.payload) {
      const { card: _card, ...rest } = e.payload;
      return { ...e, payload: rest };
    }
    return e;
  });
}
