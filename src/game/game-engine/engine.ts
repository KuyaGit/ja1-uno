import { isPlayable } from '../cards/card-utils';
import { Card, COLORS, Color } from '../cards/types';
import { buildDeck } from '../deck/build-deck';
import { Rng, shuffle } from '../deck/shuffle';
import { getSuperCardEffect } from '../effects/registry';
import { EngineError } from '../effects/super-card-effect';
import { getPlayer, updatePlayer } from '../players/player-utils';
import { defaultSettings, GameSettings } from '../rules/settings';
import { err, requireGameActive, requireIsHost, requireIsTurn, requireOwnsCard } from '../rules/validate';
import {
  countActiveEligiblePlayers,
  nextPlayerId,
  reverseDirection,
} from '../turns/turn-order';
import { GameAction, HOST_ONLY_ACTION_TYPES, SYSTEM_ONLY_ACTION_TYPES } from './actions';
import { GameEvent, event } from './events';
import { GameState, Player } from './state';

export type EngineResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: EngineError };

function ok(state: GameState, events: GameEvent[]): EngineResult {
  return { ok: true, state, events };
}
function fail(error: EngineError): EngineResult {
  return { ok: false, error };
}

export function createRoom(roomCode: string, hostId: string, hostName: string, hostAvatar: string): GameState {
  const state: GameState = {
    roomCode,
    players: [
      {
        id: hostId,
        name: hostName,
        avatar: hostAvatar,
        hand: [],
        connected: true,
        isHost: true,
        ready: true,
        calledUno: false,
      },
    ],
    order: [hostId],
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
    settings: defaultSettings(),
  };
  return state;
}

export function joinRoom(state: GameState, playerId: string, name: string, avatar: string): EngineResult {
  if (state.status !== 'LOBBY') {
    return fail(err('GAME_IN_PROGRESS', 'Cannot join: game already in progress.'));
  }
  if (state.players.some((p) => p.id === playerId)) {
    return fail(err('ALREADY_JOINED', 'Player already in room.'));
  }
  if (state.players.filter((p) => !p.removed).length >= state.settings.maxPlayers) {
    return fail(err('ROOM_FULL', 'Room is full.'));
  }
  const player: Player = {
    id: playerId,
    name,
    avatar,
    hand: [],
    connected: true,
    isHost: false,
    ready: false,
    calledUno: false,
  };
  const nextState: GameState = {
    ...state,
    players: [...state.players, player],
    order: [...state.order, playerId],
  };
  return ok(nextState, [event('PLAYER_JOINED', { playerId, name })]);
}

function reshuffleIfNeeded(state: GameState, needed: number, rng: Rng): GameState {
  if (state.drawPile.length >= needed) return state;
  if (state.discardPile.length <= 1) return state; // nothing to reshuffle
  const top = state.discardPile[state.discardPile.length - 1];
  const rest = state.discardPile.slice(0, -1);
  return {
    ...state,
    drawPile: [...state.drawPile, ...shuffle(rest, rng)],
    discardPile: [top],
  };
}

function drawCards(state: GameState, count: number, rng: Rng): { state: GameState; drawn: Card[] } {
  let s = state;
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    s = reshuffleIfNeeded(s, 1, rng);
    if (s.drawPile.length === 0) break;
    const [card, ...rest] = s.drawPile;
    drawn.push(card);
    s = { ...s, drawPile: rest };
  }
  return { state: s, drawn };
}

function giveCards(state: GameState, playerId: string, cards: Card[]): GameState {
  return updatePlayer(state, playerId, (p) => ({ ...p, hand: [...p.hand, ...cards] }));
}

function removeCardFromHand(state: GameState, playerId: string, cardId: string): { state: GameState; card: Card } {
  const player = getPlayer(state, playerId);
  const card = player?.hand.find((c) => c.id === cardId);
  if (!player || !card) throw new Error('removeCardFromHand: card not found');
  const nextState = updatePlayer(state, playerId, (p) => ({
    ...p,
    hand: p.hand.filter((c) => c.id !== cardId),
  }));
  return { state: nextState, card };
}

function isStackableAgainstPending(card: Card): boolean {
  return (card.kind === 'action' && card.action === 'draw2') || (card.kind === 'wild' && card.wild === 'wild4');
}

/** Clears UNO vulnerability once the player after the vulnerable one has acted. */
function maybeClearVulnerability(state: GameState, actingPlayerId: string): GameState {
  if (state.unoVulnerableId && state.unoVulnerableId !== actingPlayerId) {
    return { ...state, unoVulnerableId: null };
  }
  return state;
}

function advanceTurn(state: GameState, fromPlayerId: string, direction = state.direction): GameState {
  const next = nextPlayerId(state, fromPlayerId, direction);
  return { ...state, direction, currentPlayerId: next, drawnCardId: null };
}

export function applyAction(
  state: GameState,
  actorId: string,
  action: GameAction,
  rng: Rng = Math.random
): EngineResult {
  if (HOST_ONLY_ACTION_TYPES.includes(action.type)) {
    const hostErr = requireIsHost(state, actorId);
    if (hostErr) return fail(hostErr);
  }
  void SYSTEM_ONLY_ACTION_TYPES;

  switch (action.type) {
    case 'START_GAME':
      return handleStartGame(state, actorId, rng);
    case 'SET_READY':
      return handleSetReady(state, actorId, action.ready);
    case 'UPDATE_SETTINGS':
      return handleUpdateSettings(state, action.settings);
    case 'KICK':
      return handleRemovePlayer(state, action.targetId, 'PLAYER_LEFT', rng);
    case 'RESTART':
      return handleRestart(state);
    case 'END_GAME':
      return ok({ ...state, status: 'ENDED' }, [event('GAME_ENDED', { winnerId: state.winnerId })]);
    case 'SKIP_TURN_TIMEOUT':
      return handleSkipTurnTimeout(state, action.playerId);
    case 'REMOVE_PLAYER':
      return handleRemovePlayer(state, action.targetId, 'PLAYER_LEFT', rng);
    case 'PLAY_CARD':
      return handlePlayCard(state, actorId, action.cardId, action.chosenColor, rng);
    case 'USE_SUPER_CARD':
      return handleUseSuperCard(state, actorId, action.cardId, action.targetPlayerId, action.params, rng);
    case 'DRAW_CARD':
      return handleDrawCard(state, actorId, rng);
    case 'PASS':
      return handlePass(state, actorId);
    case 'CALL_UNO':
      return handleCallUno(state, actorId);
    case 'CATCH_UNO':
      return handleCatchUno(state, actorId, action.targetId, rng);
    default:
      return fail(err('UNKNOWN_ACTION', 'Unknown action type.'));
  }
}

function handleSetReady(state: GameState, actorId: string, ready: boolean): EngineResult {
  const player = getPlayer(state, actorId);
  if (!player) return fail(err('UNKNOWN_PLAYER', 'Unknown player.'));
  return ok(updatePlayer(state, actorId, (p) => ({ ...p, ready })), []);
}

function handleUpdateSettings(state: GameState, settings: Partial<GameSettings>): EngineResult {
  if (state.status !== 'LOBBY') return fail(err('GAME_IN_PROGRESS', 'Cannot change settings mid-game.'));
  return ok({ ...state, settings: { ...state.settings, ...settings } }, []);
}

function handleRestart(state: GameState): EngineResult {
  if (state.status !== 'ENDED') return fail(err('NOT_ENDED', 'Game has not ended.'));
  const resetPlayers = state.players
    .filter((p) => !p.removed)
    .map((p) => ({ ...p, hand: [], ready: p.isHost, calledUno: false }));
  return ok(
    {
      ...state,
      players: resetPlayers,
      order: resetPlayers.map((p) => p.id),
      status: 'LOBBY',
      winnerId: null,
      discardPile: [],
      drawPile: [],
      currentPlayerId: null,
      currentColor: null,
      pendingDraw: 0,
      drawnCardId: null,
      unoVulnerableId: null,
    },
    []
  );
}

function handleStartGame(state: GameState, actorId: string, rng: Rng): EngineResult {
  const hostErr = requireIsHost(state, actorId);
  if (hostErr) return fail(hostErr);
  if (state.status !== 'LOBBY') return fail(err('GAME_IN_PROGRESS', 'Game already started.'));
  const activePlayers = state.players.filter((p) => !p.removed);
  if (activePlayers.length < 2) return fail(err('NOT_ENOUGH_PLAYERS', 'Need at least 2 players to start.'));

  let deck = shuffle(buildDeck(state.settings), rng);

  let players = activePlayers.map((p) => ({ ...p, hand: [] as Card[], calledUno: false }));
  const handSize = state.settings.startingHandSize;
  for (let i = 0; i < handSize; i++) {
    players = players.map((p) => {
      const [card, ...rest] = deck;
      deck = rest;
      return { ...p, hand: [...p.hand, card] };
    });
  }

  // First discard: never wild4 or super. Find first eligible card in remaining deck.
  const eligibleIdx = deck.findIndex((c) => !(c.kind === 'wild' && c.wild === 'wild4') && c.kind !== 'super');
  let firstCard: Card;
  if (eligibleIdx === -1) {
    // Degenerate case: fabricate a safe number card rather than break invariants.
    firstCard = { id: 'fallback-0', kind: 'number', color: 'RED', value: 0 };
  } else {
    firstCard = deck[eligibleIdx];
    deck = [...deck.slice(0, eligibleIdx), ...deck.slice(eligibleIdx + 1)];
  }

  let currentColor: Color = firstCard.color ?? COLORS[Math.floor(rng() * COLORS.length)];

  let nextState: GameState = {
    ...state,
    players,
    order: players.map((p) => p.id),
    drawPile: deck,
    discardPile: [firstCard],
    currentColor,
    direction: 1,
    status: 'PLAYING',
    pendingDraw: 0,
    drawnCardId: null,
    unoVulnerableId: null,
    winnerId: null,
    currentPlayerId: players[0].id,
  };

  // Note: unlike a card played during normal play, the initial discard's action/wild effect is
  // not resolved against the first player -- everyone gets a clean, predictable starting hand
  // size and the first player simply begins their turn against that card as the active state.
  const events: GameEvent[] = [
    event('GAME_STARTED', { roomCode: state.roomCode }),
    event('TURN_CHANGED', { playerId: nextState.currentPlayerId }),
  ];
  return ok(nextState, events);
}

function handlePlayCard(
  state: GameState,
  actorId: string,
  cardId: string,
  chosenColor: Color | undefined,
  rng: Rng
): EngineResult {
  const activeErr = requireGameActive(state);
  if (activeErr) return fail(activeErr);
  const turnErr = requireIsTurn(state, actorId);
  if (turnErr) return fail(turnErr);
  const ownErr = requireOwnsCard(state, actorId, cardId);
  if (ownErr) return fail(ownErr);

  const player = getPlayer(state, actorId)!;
  const card = player.hand.find((c) => c.id === cardId)!;

  if (card.kind === 'super') {
    return fail(err('USE_SUPER_CARD_REQUIRED', 'Super cards must be played with USE_SUPER_CARD.'));
  }

  if (state.pendingDraw > 0 && !isStackableAgainstPending(card)) {
    return fail(err('MUST_RESOLVE_PENDING_DRAW', 'You must draw or stack a draw card.'));
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
  if (state.pendingDraw === 0 && !isPlayable(card, topCard, state.currentColor ?? undefined)) {
    return fail(err('NOT_PLAYABLE', 'Card does not match the top of the discard pile.'));
  }

  if (card.kind === 'wild') {
    if (!chosenColor || !COLORS.includes(chosenColor)) {
      return fail(err('COLOR_REQUIRED', 'A color must be chosen when playing a wild card.'));
    }
  }

  let { state: afterRemove, card: playedCard } = removeCardFromHand(state, actorId, cardId);
  afterRemove = { ...afterRemove, discardPile: [...afterRemove.discardPile, playedCard], drawnCardId: null };

  const events: GameEvent[] = [event('CARD_PLAYED', { playerId: actorId, card: playedCard })];

  const playerAfter = getPlayer(afterRemove, actorId)!;
  if (playerAfter.hand.length === 0) {
    const ended = finishGame(afterRemove, actorId);
    events.push(event('PLAYER_WON', { playerId: actorId }));
    events.push(event('GAME_ENDED', { winnerId: actorId }));
    return ok(ended, events);
  }

  afterRemove = updateUnoStateAfterOwnPlay(afterRemove, actorId);
  afterRemove = maybeClearVulnerability(afterRemove, actorId);

  let currentColor: Color = afterRemove.currentColor as Color;
  if (playedCard.kind === 'wild') {
    currentColor = chosenColor as Color;
    afterRemove = { ...afterRemove, currentColor };
    events.push(event('WILD_PLAYED', { playerId: actorId, wild: playedCard.wild }));
    events.push(event('COLOR_CHANGED', { color: currentColor, by: actorId }));
  } else if (playedCard.color) {
    currentColor = playedCard.color;
    afterRemove = { ...afterRemove, currentColor };
  }

  let nextState = afterRemove;

  if (playedCard.kind === 'action' && playedCard.action === 'skip') {
    const skippedId = nextPlayerId(nextState, actorId, nextState.direction);
    nextState = skippedId
      ? advanceTurn(nextState, skippedId, nextState.direction)
      : advanceTurn(nextState, actorId, nextState.direction);
    if (skippedId) events.push(event('PLAYER_SKIPPED', { playerId: skippedId }));
  } else if (playedCard.kind === 'action' && playedCard.action === 'reverse') {
    const twoPlayers = countActiveEligiblePlayers(nextState) === 2;
    if (twoPlayers) {
      const skippedId = nextPlayerId(nextState, actorId, nextState.direction);
      nextState = skippedId
        ? advanceTurn(nextState, skippedId, nextState.direction)
        : advanceTurn(nextState, actorId, nextState.direction);
      if (skippedId) events.push(event('PLAYER_SKIPPED', { playerId: skippedId }));
    } else {
      const newDirection = reverseDirection(nextState.direction);
      events.push(event('REVERSE_ACTIVATED', { by: actorId }));
      nextState = advanceTurn(nextState, actorId, newDirection);
    }
  } else if (playedCard.kind === 'action' && playedCard.action === 'draw2') {
    nextState = resolveDrawCardEffect(nextState, actorId, 2, rng, events);
  } else if (playedCard.kind === 'wild' && playedCard.wild === 'wild4') {
    nextState = resolveDrawCardEffect(nextState, actorId, 4, rng, events);
  } else {
    nextState = advanceTurn(nextState, actorId, nextState.direction);
  }

  events.push(event('TURN_CHANGED', { playerId: nextState.currentPlayerId }));
  return ok(nextState, events);
}

function resolveDrawCardEffect(
  state: GameState,
  actorId: string,
  amount: number,
  rng: Rng,
  events: GameEvent[]
): GameState {
  if (state.settings.stackingDraws) {
    const stacked = { ...state, pendingDraw: state.pendingDraw + amount };
    return advanceTurn(stacked, actorId, stacked.direction);
  }
  const targetId = nextPlayerId(state, actorId, state.direction);
  if (!targetId) return advanceTurn(state, actorId, state.direction);
  const { state: afterDraw, drawn } = drawCards(state, amount, rng);
  const withCards = giveCards(afterDraw, targetId, drawn);
  events.push(event('DRAW_TWO', { playerId: targetId, count: drawn.length }));
  events.push(event('PLAYER_SKIPPED', { playerId: targetId }));
  return advanceTurn(withCards, targetId, withCards.direction);
}

function updateUnoStateAfterOwnPlay(state: GameState, actorId: string): GameState {
  const player = getPlayer(state, actorId)!;
  if (player.hand.length === 1) {
    if (!player.calledUno) {
      return { ...state, unoVulnerableId: actorId };
    }
    return state;
  }
  let next = state;
  if (state.unoVulnerableId === actorId) next = { ...next, unoVulnerableId: null };
  if (player.calledUno) next = updatePlayer(next, actorId, (p) => ({ ...p, calledUno: false }));
  return next;
}

function finishGame(state: GameState, winnerId: string): GameState {
  return { ...state, status: 'ENDED', winnerId, currentPlayerId: null };
}

function handleUseSuperCard(
  state: GameState,
  actorId: string,
  cardId: string,
  targetPlayerId: string | undefined,
  params: Record<string, unknown> | undefined,
  rng: Rng
): EngineResult {
  const activeErr = requireGameActive(state);
  if (activeErr) return fail(activeErr);
  const turnErr = requireIsTurn(state, actorId);
  if (turnErr) return fail(turnErr);
  const ownErr = requireOwnsCard(state, actorId, cardId);
  if (ownErr) return fail(ownErr);

  const player = getPlayer(state, actorId)!;
  const card = player.hand.find((c) => c.id === cardId)!;
  if (card.kind !== 'super' || !card.superType) {
    return fail(err('NOT_SUPER_CARD', 'That card is not a super card.'));
  }
  if (state.pendingDraw > 0) {
    return fail(err('MUST_RESOLVE_PENDING_DRAW', 'You must draw or stack a draw card.'));
  }

  const effect = getSuperCardEffect(card.superType);
  if (!effect.canPlay(state, actorId)) {
    return fail(err('CANNOT_PLAY_NOW', 'This super card cannot be played right now.'));
  }
  const fullParams = { ...(params ?? {}), targetPlayerId } as Record<string, unknown>;
  const validationErr = effect.validate(state, actorId, card, fullParams);
  if (validationErr) return fail(validationErr);

  let { state: afterRemove, card: playedCard } = removeCardFromHand(state, actorId, cardId);
  afterRemove = { ...afterRemove, discardPile: [...afterRemove.discardPile, playedCard], drawnCardId: null };

  const events: GameEvent[] = [event('CARD_PLAYED', { playerId: actorId, card: playedCard })];

  const playerAfter = getPlayer(afterRemove, actorId)!;
  if (playerAfter.hand.length === 0) {
    const ended = finishGame(afterRemove, actorId);
    events.push(event('PLAYER_WON', { playerId: actorId }));
    events.push(event('GAME_ENDED', { winnerId: actorId }));
    return ok(ended, events);
  }

  afterRemove = updateUnoStateAfterOwnPlay(afterRemove, actorId);
  afterRemove = maybeClearVulnerability(afterRemove, actorId);

  const applied = effect.apply(afterRemove, actorId, playedCard, fullParams);
  let nextState = applied.state;
  events.push(...applied.events);

  nextState = advanceTurn(nextState, actorId, nextState.direction);
  void rng;
  events.push(event('TURN_CHANGED', { playerId: nextState.currentPlayerId }));
  return ok(nextState, events);
}

function handleDrawCard(state: GameState, actorId: string, rng: Rng): EngineResult {
  const activeErr = requireGameActive(state);
  if (activeErr) return fail(activeErr);
  const turnErr = requireIsTurn(state, actorId);
  if (turnErr) return fail(turnErr);

  if (state.pendingDraw > 0) {
    const amount = state.pendingDraw;
    const { state: afterDraw, drawn } = drawCards(state, amount, rng);
    let nextState = giveCards(afterDraw, actorId, drawn);
    nextState = { ...nextState, pendingDraw: 0 };
    nextState = maybeClearVulnerability(nextState, actorId);
    const events: GameEvent[] = [event('CARD_DRAWN', { playerId: actorId, count: drawn.length })];
    nextState = advanceTurn(nextState, actorId, nextState.direction);
    events.push(event('TURN_CHANGED', { playerId: nextState.currentPlayerId }));
    return ok(nextState, events);
  }

  if (state.drawnCardId !== null) {
    return fail(err('ALREADY_DRAWN', 'Already drew a card this turn.'));
  }

  const { state: afterDraw, drawn } = drawCards(state, 1, rng);
  if (drawn.length === 0) {
    return fail(err('DRAW_PILE_EMPTY', 'No cards left to draw.'));
  }
  let nextState = giveCards(afterDraw, actorId, drawn);
  nextState = { ...nextState, drawnCardId: drawn[0].id };
  nextState = maybeClearVulnerability(nextState, actorId);
  return ok(nextState, [event('CARD_DRAWN', { playerId: actorId, card: drawn[0], count: 1 })]);
}

function handlePass(state: GameState, actorId: string): EngineResult {
  const activeErr = requireGameActive(state);
  if (activeErr) return fail(activeErr);
  const turnErr = requireIsTurn(state, actorId);
  if (turnErr) return fail(turnErr);
  if (state.drawnCardId === null) {
    return fail(err('MUST_DRAW_FIRST', 'You may only pass after drawing.'));
  }
  let nextState = maybeClearVulnerability(state, actorId);
  nextState = advanceTurn(nextState, actorId, nextState.direction);
  return ok(nextState, [event('TURN_CHANGED', { playerId: nextState.currentPlayerId })]);
}

function handleCallUno(state: GameState, actorId: string): EngineResult {
  const activeErr = requireGameActive(state);
  if (activeErr) return fail(activeErr);
  const player = getPlayer(state, actorId);
  if (!player) return fail(err('UNKNOWN_PLAYER', 'Unknown player.'));
  if (player.hand.length !== 1 && player.hand.length !== 2) {
    return fail(err('INVALID_UNO_CALL', 'Can only call UNO at 2 cards (about to play) or 1 card.'));
  }
  let nextState = updatePlayer(state, actorId, (p) => ({ ...p, calledUno: true }));
  if (nextState.unoVulnerableId === actorId) {
    nextState = { ...nextState, unoVulnerableId: null };
  }
  return ok(nextState, [event('UNO_CALLED', { playerId: actorId })]);
}

function handleCatchUno(state: GameState, actorId: string, targetId: string, rng: Rng): EngineResult {
  const activeErr = requireGameActive(state);
  if (activeErr) return fail(activeErr);
  if (state.unoVulnerableId !== targetId) {
    return fail(err('NOT_VULNERABLE', 'Target is not vulnerable to a UNO catch.'));
  }
  if (actorId === targetId) {
    return fail(err('INVALID_TARGET', 'Cannot catch yourself.'));
  }
  const { state: afterDraw, drawn } = drawCards(state, 2, rng);
  let nextState = giveCards(afterDraw, targetId, drawn);
  nextState = { ...nextState, unoVulnerableId: null };
  return ok(nextState, [event('UNO_CAUGHT', { playerId: targetId, by: actorId, count: drawn.length })]);
}

function handleSkipTurnTimeout(state: GameState, playerId: string): EngineResult {
  if (state.currentPlayerId !== playerId) {
    return fail(err('NOT_CURRENT_PLAYER', 'Player is not the current player.'));
  }
  let nextState = maybeClearVulnerability(state, playerId);
  nextState = advanceTurn(nextState, playerId, nextState.direction);
  return ok(nextState, [
    event('PLAYER_SKIPPED', { playerId }),
    event('TURN_CHANGED', { playerId: nextState.currentPlayerId }),
  ]);
}

function handleRemovePlayer(
  state: GameState,
  targetId: string,
  leaveEvent: 'PLAYER_LEFT',
  rng: Rng
): EngineResult {
  const target = getPlayer(state, targetId);
  if (!target) return fail(err('UNKNOWN_PLAYER', 'Unknown player.'));

  const events: GameEvent[] = [];
  let nextState = state;

  const wasCurrent = state.currentPlayerId === targetId;
  let newCurrent = state.currentPlayerId;
  if (wasCurrent && state.status === 'PLAYING') {
    newCurrent = nextPlayerId({ ...state, players: state.players.map((p) => (p.id === targetId ? { ...p, removed: true } : p)) }, targetId, state.direction);
  }

  const orphanedHand = target.hand;
  nextState = {
    ...nextState,
    players: nextState.players.map((p) => (p.id === targetId ? { ...p, removed: true, hand: [] } : p)),
    order: nextState.order.filter((id) => id !== targetId),
    discardPile: nextState.discardPile,
    drawPile: orphanedHand.length > 0 ? shuffle([...nextState.drawPile, ...orphanedHand], rng) : nextState.drawPile,
  };

  if (wasCurrent && state.status === 'PLAYING') {
    nextState = { ...nextState, currentPlayerId: newCurrent, drawnCardId: null };
    events.push(event('TURN_CHANGED', { playerId: newCurrent }));
  }

  if (nextState.unoVulnerableId === targetId) {
    nextState = { ...nextState, unoVulnerableId: null };
  }

  events.unshift(event(leaveEvent, { playerId: targetId }));

  const remainingActive = nextState.players.filter((p) => !p.removed);
  if (nextState.status === 'PLAYING' && remainingActive.length < 2) {
    nextState = { ...nextState, status: 'ENDED', winnerId: remainingActive[0]?.id ?? null, currentPlayerId: null };
    events.push(event('GAME_ENDED', { winnerId: nextState.winnerId }));
  }

  return ok(nextState, events);
}

/** Marks connection status directly (called by the host server, not part of the reducer's action union). */
export function setConnectionStatus(state: GameState, playerId: string, connected: boolean): EngineResult {
  const player = getPlayer(state, playerId);
  if (!player) return fail(err('UNKNOWN_PLAYER', 'Unknown player.'));
  const nextState = updatePlayer(state, playerId, (p) => ({ ...p, connected }));
  return ok(nextState, [event(connected ? 'PLAYER_RECONNECTED' : 'PLAYER_DISCONNECTED', { playerId })]);
}
