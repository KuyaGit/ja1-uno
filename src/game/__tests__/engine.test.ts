import { applyAction, createRoom, joinRoom } from '../game-engine/engine';
import { mulberry32 } from '../deck/shuffle';
import { toPlayerView } from '../game-engine/view';
import { actionCard, makePlayer, makeState, numberCard, superCard, wildCard } from './test-helpers';

describe('lobby + start game', () => {
  it('creates a room with the host and allows others to join', () => {
    let state = createRoom('ABCD', 'p1', 'Host', '🦄');
    expect(state.players).toHaveLength(1);
    expect(state.players[0].isHost).toBe(true);

    const res = joinRoom(state, 'p2', 'Guest', '🐸');
    expect(res.ok).toBe(true);
    if (res.ok) state = res.state;
    expect(state.players).toHaveLength(2);
  });

  it('refuses to start with fewer than 2 players', () => {
    const state = createRoom('ABCD', 'p1', 'Host', '🦄');
    const res = applyAction(state, 'p1', { type: 'START_GAME' }, mulberry32(1));
    expect(res.ok).toBe(false);
  });

  it('deals the configured hand size to each player and sets a valid first discard', () => {
    let state = createRoom('ABCD', 'p1', 'Host', '🦄');
    const joined = joinRoom(state, 'p2', 'Guest', '🐸');
    expect(joined.ok).toBe(true);
    if (joined.ok) state = joined.state;

    const res = applyAction(state, 'p1', { type: 'START_GAME' }, mulberry32(123));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.status).toBe('PLAYING');
    for (const p of res.state.players) {
      expect(p.hand).toHaveLength(7);
    }
    const top = res.state.discardPile[res.state.discardPile.length - 1];
    expect(top.kind).not.toBe('super');
    expect(top.kind === 'wild' ? top.wild : undefined).not.toBe('wild4');
    expect(res.state.currentPlayerId).toBeTruthy();
  });
});

describe('play card matching rules', () => {
  it('allows playing a card matching color', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [numberCard('RED', 3)] }),
        makePlayer({ id: 'p2', hand: [numberCard('BLUE', 9)] }),
      ],
      discardPile: [numberCard('RED', 5)],
      currentColor: 'RED',
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
  });

  it('allows playing a card matching value across colors', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [numberCard('BLUE', 5)] }),
        makePlayer({ id: 'p2', hand: [numberCard('BLUE', 9)] }),
      ],
      discardPile: [numberCard('RED', 5)],
      currentColor: 'RED',
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
  });

  it('rejects a non-matching card', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [numberCard('BLUE', 9)] }),
        makePlayer({ id: 'p2', hand: [numberCard('BLUE', 1)] }),
      ],
      discardPile: [numberCard('RED', 5)],
      currentColor: 'RED',
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(false);
  });

  it('rejects playing out of turn', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [numberCard('RED', 3)] }),
        makePlayer({ id: 'p2', hand: [numberCard('RED', 1)] }),
      ],
      currentPlayerId: 'p2',
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NOT_YOUR_TURN');
  });

  it('rejects playing a card the player does not own', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [numberCard('RED', 1)] })],
    });
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: 'not-owned' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CARD_NOT_OWNED');
  });

  it('requires a chosen color for wild cards', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [wildCard('wild')] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('COLOR_REQUIRED');
  });

  it('sets currentColor from chosenColor on a wild play', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [wildCard('wild'), numberCard('RED', 1)] }),
        makePlayer({ id: 'p2', hand: [] }),
      ],
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id, chosenColor: 'GREEN' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.currentColor).toBe('GREEN');
  });
});

describe('skip / reverse', () => {
  it('skip advances two players in a 3+ player game', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [actionCard('RED', 'skip'), numberCard('RED', 1)] }),
        makePlayer({ id: 'p2', hand: [] }),
        makePlayer({ id: 'p3', hand: [] }),
      ],
      order: ['p1', 'p2', 'p3'],
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.currentPlayerId).toBe('p3');
  });

  it('reverse flips direction in a 3+ player game', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [actionCard('RED', 'reverse'), numberCard('RED', 1)] }),
        makePlayer({ id: 'p2', hand: [] }),
        makePlayer({ id: 'p3', hand: [] }),
      ],
      order: ['p1', 'p2', 'p3'],
      direction: 1,
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.direction).toBe(-1);
      expect(res.state.currentPlayerId).toBe('p3');
    }
  });

  it('reverse acts as skip in a 2-player game', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [actionCard('RED', 'reverse'), numberCard('RED', 1)] }),
        makePlayer({ id: 'p2', hand: [] }),
      ],
      order: ['p1', 'p2'],
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.currentPlayerId).toBe('p1');
  });
});

describe('draw2 / wild4', () => {
  it('non-stacking: next player draws 2 and loses their turn', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [actionCard('RED', 'draw2'), numberCard('RED', 1)] }),
        makePlayer({ id: 'p2', hand: [] }),
        makePlayer({ id: 'p3', hand: [] }),
      ],
      order: ['p1', 'p2', 'p3'],
      drawPile: [numberCard('BLUE', 1), numberCard('BLUE', 2), numberCard('BLUE', 3)],
      settings: { stackingDraws: false },
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const p2 = res.state.players.find((p) => p.id === 'p2')!;
      expect(p2.hand).toHaveLength(2);
      expect(res.state.currentPlayerId).toBe('p3');
      expect(res.state.pendingDraw).toBe(0);
    }
  });

  it('stacking: draw2 accumulates pendingDraw instead of resolving immediately', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [actionCard('RED', 'draw2'), numberCard('RED', 1)] }),
        makePlayer({ id: 'p2', hand: [actionCard('RED', 'draw2'), numberCard('RED', 1)] }),
      ],
      order: ['p1', 'p2'],
      settings: { stackingDraws: true },
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.pendingDraw).toBe(2);
      expect(res.state.currentPlayerId).toBe('p2');
      const p2 = res.state.players.find((p) => p.id === 'p2')!;
      expect(p2.hand).toHaveLength(2); // unaffected until they draw or stack

      // p2 stacks their own draw2 on top
      const stackRes = applyAction(res.state, 'p2', { type: 'PLAY_CARD', cardId: p2.hand[0].id });
      expect(stackRes.ok).toBe(true);
      if (stackRes.ok) expect(stackRes.state.pendingDraw).toBe(4);
    }
  });

  it('stacking: DRAW_CARD resolves the full pendingDraw and ends the turn', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
      order: ['p1', 'p2'],
      currentPlayerId: 'p2',
      pendingDraw: 4,
      drawPile: [numberCard('BLUE', 1), numberCard('BLUE', 2), numberCard('BLUE', 3), numberCard('BLUE', 4)],
      settings: { stackingDraws: true },
    });
    const res = applyAction(state, 'p2', { type: 'DRAW_CARD' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const p2 = res.state.players.find((p) => p.id === 'p2')!;
      expect(p2.hand).toHaveLength(4);
      expect(res.state.pendingDraw).toBe(0);
      expect(res.state.currentPlayerId).toBe('p1');
    }
  });

  it('rejects a non-stacking card while pendingDraw is active', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [numberCard('RED', 3)] }), makePlayer({ id: 'p2', hand: [] })],
      pendingDraw: 2,
      settings: { stackingDraws: true },
    });
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: state.players[0].hand[0].id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MUST_RESOLVE_PENDING_DRAW');
  });
});

describe('draw pile reshuffle', () => {
  it('reshuffles the discard pile (minus the top card) into the draw pile when empty', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
      drawPile: [],
      discardPile: [numberCard('RED', 1), numberCard('RED', 2), numberCard('RED', 5)],
    });
    const res = applyAction(state, 'p1', { type: 'DRAW_CARD' }, mulberry32(5));
    expect(res.ok).toBe(true);
    if (res.ok) {
      // discard pile keeps only its original top card
      expect(res.state.discardPile).toHaveLength(1);
      expect(res.state.discardPile[0].value).toBe(5);
      const p1 = res.state.players.find((p) => p.id === 'p1')!;
      expect(p1.hand).toHaveLength(1);
    }
  });
});

describe('draw / pass flow', () => {
  it('lets a player draw then pass', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const drawRes = applyAction(state, 'p1', { type: 'DRAW_CARD' });
    expect(drawRes.ok).toBe(true);
    if (!drawRes.ok) return;
    expect(drawRes.state.currentPlayerId).toBe('p1'); // still their turn
    const passRes = applyAction(drawRes.state, 'p1', { type: 'PASS' });
    expect(passRes.ok).toBe(true);
    if (passRes.ok) expect(passRes.state.currentPlayerId).toBe('p2');
  });

  it('rejects PASS before drawing', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const res = applyAction(state, 'p1', { type: 'PASS' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MUST_DRAW_FIRST');
  });

  it('rejects drawing twice in the same turn', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const first = applyAction(state, 'p1', { type: 'DRAW_CARD' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyAction(first.state, 'p1', { type: 'DRAW_CARD' });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('ALREADY_DRAWN');
  });
});

describe('UNO call and catch', () => {
  it('marks a player vulnerable when they play down to 1 card without calling UNO', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [numberCard('RED', 3), numberCard('RED', 4)] }),
        makePlayer({ id: 'p2', hand: [] }),
      ],
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.unoVulnerableId).toBe('p1');
  });

  it('CALL_UNO before/at 1 card clears vulnerability', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [numberCard('RED', 3)] }), makePlayer({ id: 'p2', hand: [] })],
      unoVulnerableId: 'p1',
    });
    const res = applyAction(state, 'p1', { type: 'CALL_UNO' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.unoVulnerableId).toBeNull();
      expect(res.state.players.find((p) => p.id === 'p1')!.calledUno).toBe(true);
    }
  });

  it('CATCH_UNO gives the vulnerable player a 2-card penalty', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [numberCard('RED', 3)] }), makePlayer({ id: 'p2', hand: [] })],
      unoVulnerableId: 'p1',
      drawPile: [numberCard('BLUE', 1), numberCard('BLUE', 2)],
    });
    const res = applyAction(state, 'p2', { type: 'CATCH_UNO', targetId: 'p1' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.unoVulnerableId).toBeNull();
      expect(res.state.players.find((p) => p.id === 'p1')!.hand).toHaveLength(3);
    }
  });

  it('rejects CATCH_UNO against a non-vulnerable player', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const res = applyAction(state, 'p2', { type: 'CATCH_UNO', targetId: 'p1' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NOT_VULNERABLE');
  });
});

describe('win detection', () => {
  it('ends the game the moment a hand reaches 0', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [numberCard('RED', 3)] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', { type: 'PLAY_CARD', cardId: card.id });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.status).toBe('ENDED');
      expect(res.state.winnerId).toBe('p1');
    }
  });
});

describe('SWAP super card', () => {
  it('rejects targeting yourself', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [superCard('SWAP'), numberCard('RED', 3)] }),
        makePlayer({ id: 'p2', hand: [numberCard('BLUE', 1)] }),
      ],
      settings: { enabledSuperCards: ['SWAP'] },
    });
    const card = state.players[0].hand[0];
    const res = applyAction(state, 'p1', {
      type: 'USE_SUPER_CARD',
      cardId: card.id,
      targetPlayerId: 'p1',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_TARGET');
  });

  it('rejects a missing target', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [superCard('SWAP')] }),
        makePlayer({ id: 'p2', hand: [numberCard('BLUE', 1)] }),
      ],
    });
    const res = applyAction(state, 'p1', { type: 'USE_SUPER_CARD', cardId: state.players[0].hand[0].id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MISSING_TARGET');
  });

  it('rejects a disconnected target', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [superCard('SWAP')] }),
        makePlayer({ id: 'p2', hand: [numberCard('BLUE', 1)], connected: false }),
      ],
    });
    const res = applyAction(state, 'p1', {
      type: 'USE_SUPER_CARD',
      cardId: state.players[0].hand[0].id,
      targetPlayerId: 'p2',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_TARGET');
  });

  it('rejects a nonexistent target', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [superCard('SWAP')] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const res = applyAction(state, 'p1', {
      type: 'USE_SUPER_CARD',
      cardId: state.players[0].hand[0].id,
      targetPlayerId: 'ghost',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_TARGET');
  });

  it('rejects when it is not the actor turn', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [superCard('SWAP')] }), makePlayer({ id: 'p2', hand: [] })],
      currentPlayerId: 'p2',
    });
    const res = applyAction(state, 'p1', {
      type: 'USE_SUPER_CARD',
      cardId: state.players[0].hand[0].id,
      targetPlayerId: 'p2',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NOT_YOUR_TURN');
  });

  it('rejects a card the actor does not own', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const res = applyAction(state, 'p1', {
      type: 'USE_SUPER_CARD',
      cardId: 'not-owned',
      targetPlayerId: 'p2',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('CARD_NOT_OWNED');
  });

  it('swaps hands immediately on a valid target', () => {
    const p1Hand = [superCard('SWAP'), numberCard('RED', 3)];
    const p2Hand = [numberCard('BLUE', 1), numberCard('BLUE', 2), numberCard('BLUE', 3)];
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: p1Hand }), makePlayer({ id: 'p2', hand: p2Hand })],
    });
    const swapId = p1Hand[0].id;
    const res = applyAction(state, 'p1', {
      type: 'USE_SUPER_CARD',
      cardId: swapId,
      targetPlayerId: 'p2',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const p1 = res.state.players.find((p) => p.id === 'p1')!;
      const p2 = res.state.players.find((p) => p.id === 'p2')!;
      expect(p1.hand.map((c) => c.id)).toEqual(p2Hand.map((c) => c.id));
      expect(p2.hand.map((c) => c.id)).toEqual([p1Hand[1].id]);
    }
  });

  it('winning by playing SWAP as the last card does not perform the swap', () => {
    const p2Hand = [numberCard('BLUE', 1), numberCard('BLUE', 2)];
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [superCard('SWAP')] }), makePlayer({ id: 'p2', hand: p2Hand })],
    });
    const swapId = state.players[0].hand[0].id;
    const res = applyAction(state, 'p1', { type: 'USE_SUPER_CARD', cardId: swapId, targetPlayerId: 'p2' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.status).toBe('ENDED');
      expect(res.state.winnerId).toBe('p1');
      const p2 = res.state.players.find((p) => p.id === 'p2')!;
      // p2's hand is untouched -- swap never happened
      expect(p2.hand.map((c) => c.id)).toEqual(p2Hand.map((c) => c.id));
    }
  });
});

describe('toPlayerView redaction', () => {
  it('never leaks other players hand contents, only counts', () => {
    const state = makeState({
      players: [
        makePlayer({ id: 'p1', hand: [numberCard('RED', 3), numberCard('BLUE', 4)] }),
        makePlayer({ id: 'p2', hand: [numberCard('GREEN', 1)] }),
      ],
    });
    const view = toPlayerView(state, 'p1');
    expect(view.yourHand).toHaveLength(2);
    const p2View = view.players.find((p) => p.id === 'p2')!;
    expect(p2View.handCount).toBe(1);
    expect((p2View as any).hand).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('GREEN');
  });

  it('hides draw pile contents entirely', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
      drawPile: [numberCard('YELLOW', 7), numberCard('YELLOW', 8)],
    });
    const view = toPlayerView(state, 'p1');
    expect(view.drawPileCount).toBe(2);
    expect(JSON.stringify(view)).not.toContain('YELLOW');
  });

  it('only reveals the drawn card identity to the drawing player', () => {
    const state = makeState({
      players: [makePlayer({ id: 'p1', hand: [] }), makePlayer({ id: 'p2', hand: [] })],
    });
    const res = applyAction(state, 'p1', { type: 'DRAW_CARD' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const p1View = toPlayerView(res.state, 'p1');
    const p2View = toPlayerView(res.state, 'p2');
    expect(p1View.yourDrawnCardId).toBe(res.state.drawnCardId);
    expect(p2View.yourDrawnCardId).toBeNull();
  });
});
