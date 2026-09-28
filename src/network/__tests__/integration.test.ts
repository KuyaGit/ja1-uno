import { isPlayable } from '@/game/cards/card-utils';
import { Card, COLORS } from '@/game/cards/types';
import { PlayerGameView } from '@/game/game-engine/view';
import { delay, startTestServer, TestClient, TestServer } from './test-utils';

describe('room join / roster', () => {
  let test: TestServer;
  afterEach(async () => test && test.close());

  it('allows 2-6 players to join a room', async () => {
    test = await startTestServer();
    const host = new TestClient(test.port);
    await host.hello('ROOM1', 'Host', '🦄', test.hostToken);

    const guests: TestClient[] = [];
    for (let i = 0; i < 4; i++) {
      const guest = new TestClient(test.port);
      const welcome = await guest.hello('ROOM1', `Guest${i}`, '🐸');
      expect(welcome.type).toBe('WELCOME');
      guests.push(guest);
    }

    const state = await host.waitFor((m) => m.type === 'STATE' && m.view.players.length === 5);
    expect(state.type).toBe('STATE');
    if (state.type === 'STATE') expect(state.view.players).toHaveLength(5); // host + 4 guests

    for (const g of guests) g.close();
    host.close();
  });

  it('rejects a wrong room code', async () => {
    test = await startTestServer();
    const client = new TestClient(test.port);
    const res = await client.hello('WRONG', 'X', '🙂');
    expect(res.type).toBe('ERROR');
    if (res.type === 'ERROR') expect(res.code).toBe('WRONG_ROOM');
    await client.waitForClose();
    client.close();
  });

  it('returns ERROR for an invalid action instead of crashing the connection', async () => {
    test = await startTestServer();
    const host = new TestClient(test.port);
    await host.hello('ROOM1', 'Host', '🦄', test.hostToken);
    host.send({ type: 'ACTION', action: { type: 'PLAY_CARD', cardId: 'not-a-real-card' }, requestId: 'r1' });
    const err = await host.waitFor((m) => m.type === 'ERROR');
    expect(err.type).toBe('ERROR');
    if (err.type === 'ERROR') {
      expect(err.code).toBe('GAME_NOT_ACTIVE');
      expect(err.requestId).toBe('r1');
    }
    host.close();
  });
});

describe('simultaneous actions are serialized', () => {
  let test: TestServer;
  afterEach(async () => test && test.close());

  it('applies concurrently-sent actions from different players one at a time, without corrupting state', async () => {
    test = await startTestServer();
    const host = new TestClient(test.port);
    await host.hello('ROOM1', 'Host', '🦄', test.hostToken);
    const guest = new TestClient(test.port);
    await guest.hello('ROOM1', 'Guest', '🐸');

    host.send({ type: 'ACTION', action: { type: 'SET_READY', ready: true } });
    guest.send({ type: 'ACTION', action: { type: 'SET_READY', ready: true } });
    host.send({ type: 'ACTION', action: { type: 'START_GAME' } });

    const state = await host.waitFor(
      (m) => m.type === 'STATE' && m.view.status === 'PLAYING'
    );
    expect(state.type).toBe('STATE');
    if (state.type === 'STATE') {
      // Exactly one deal happened -- hand sizes are sane, not doubled/corrupted by a race.
      const total = state.view.players.reduce((sum, p) => sum + p.handCount, 0);
      expect(total).toBe(14); // 2 players * 7 cards
    }
    host.close();
    guest.close();
  });
});

describe('disconnect / reconnect', () => {
  let test: TestServer;
  afterEach(async () => test && test.close());

  it('restores a hand on reconnect using the stored session token', async () => {
    test = await startTestServer();
    const host = new TestClient(test.port);
    const welcome = await host.hello('ROOM1', 'Host', '🦄', test.hostToken);
    const guest = new TestClient(test.port);
    const guestWelcome = await guest.hello('ROOM1', 'Guest', '🐸');
    expect(guestWelcome.type).toBe('WELCOME');
    const guestToken = guestWelcome.type === 'WELCOME' ? guestWelcome.sessionToken : '';
    void welcome;

    host.send({ type: 'ACTION', action: { type: 'START_GAME' } });
    await host.waitFor((m) => m.type === 'STATE' && m.view.status === 'PLAYING');
    const beforeState = await guest.waitFor((m) => m.type === 'STATE' && m.view.status === 'PLAYING');
    const handBefore = beforeState.type === 'STATE' ? beforeState.view.yourHand.length : -1;
    expect(handBefore).toBe(7);

    guest.close();
    await delay(50);

    const reconnected = new TestClient(test.port);
    const reWelcome = await reconnected.hello('ROOM1', 'Guest', '🐸', guestToken);
    expect(reWelcome.type).toBe('WELCOME');
    const afterState = await reconnected.waitFor((m) => m.type === 'STATE');
    expect(afterState.type).toBe('STATE');
    if (afterState.type === 'STATE') expect(afterState.view.yourHand.length).toBe(7);

    host.close();
    reconnected.close();
  });
});

describe('turn timeout auto-skip', () => {
  let test: TestServer;
  afterEach(async () => test && test.close());

  it('skips a disconnected current player automatically', async () => {
    test = await startTestServer();
    const host = new TestClient(test.port);
    await host.hello('ROOM1', 'Host', '🦄', test.hostToken);
    const guest = new TestClient(test.port);
    await guest.hello('ROOM1', 'Guest', '🐸');

    host.send({ type: 'ACTION', action: { type: 'START_GAME' } });
    const started = await host.waitFor((m) => m.type === 'STATE' && m.view.status === 'PLAYING');
    const firstPlayerId = started.type === 'STATE' ? started.view.currentPlayerId : null;

    // Whichever of the two is current, disconnect them so the timeout has to fire.
    const currentIsHost = firstPlayerId === (started.type === 'STATE' ? started.view.players[0].id : null);
    const toDisconnect = currentIsHost ? host : guest;
    const observer = currentIsHost ? guest : host;

    toDisconnect.close();

    const skippedState = await observer.waitForNext(
      (m) =>
        m.type === 'STATE' &&
        m.view.status === 'PLAYING' &&
        m.view.currentPlayerId !== null &&
        m.view.currentPlayerId !== firstPlayerId,
      20_000
    );
    expect(skippedState.type).toBe('STATE');

    observer.close();
  }, 25_000);
});

describe('host closing', () => {
  let test: TestServer;

  it('notifies remaining connections when the host server stops', async () => {
    test = await startTestServer();
    const host = new TestClient(test.port);
    await host.hello('ROOM1', 'Host', '🦄', test.hostToken);
    const guest = new TestClient(test.port);
    await guest.hello('ROOM1', 'Guest', '🐸');

    await test.close();

    const code = await guest.waitForClose();
    expect(code).toBeGreaterThan(0);
    host.close();
    guest.close();
  });
});

describe('full game reaches a win', () => {
  let test: TestServer;
  afterEach(async () => test && test.close());

  it('an automated 2-player game can be played to completion', async () => {
    test = await startTestServer();
    const host = new TestClient(test.port);
    await host.hello('ROOM1', 'Host', '🦄', test.hostToken);
    const guest = new TestClient(test.port);
    await guest.hello('ROOM1', 'Guest', '🐸');

    // Disable super cards for this bot-driven game -- SWAP is exhaustively covered by the engine
    // unit tests already, and a naive bot that never uses it would otherwise stall forever once
    // one lands in a hand (drawing endlessly without ever being able to discard it).
    host.send({ type: 'ACTION', action: { type: 'UPDATE_SETTINGS', settings: { enabledSuperCards: [] } } });
    host.send({ type: 'ACTION', action: { type: 'START_GAME' } });
    let state = await host.waitFor((m) => m.type === 'STATE' && m.view.status === 'PLAYING');
    expect(state.type).toBe('STATE');

    const clientsByPlayerId: Record<string, TestClient> = {};
    const hostView = state.type === 'STATE' ? state.view : null;
    expect(hostView).not.toBeNull();

    // Figure out which socket owns which player id from the WELCOME messages already received.
    const hostWelcome = host.messages.find((m) => m.type === 'WELCOME');
    const guestWelcome = guest.messages.find((m) => m.type === 'WELCOME');
    if (hostWelcome?.type === 'WELCOME') clientsByPlayerId[hostWelcome.playerId] = host;
    if (guestWelcome?.type === 'WELCOME') clientsByPlayerId[guestWelcome.playerId] = guest;

    let latestView: PlayerGameView = hostView!;
    let guard = 0;
    const maxTurns = 500;

    while (latestView.status === 'PLAYING' && guard < maxTurns) {
      guard += 1;
      const actorId = latestView.currentPlayerId!;
      const actor = clientsByPlayerId[actorId];
      const nonActor = actor === host ? guest : host;

      const handMsg = actor.messages.filter((m) => m.type === 'STATE').pop();
      const hand: Card[] = handMsg && handMsg.type === 'STATE' ? handMsg.view.yourHand : [];
      const topCard = latestView.discardTop!;
      const currentColor = latestView.currentColor ?? undefined;

      const playable = hand.find((c) => c.kind !== 'super' && isPlayable(c, topCard, currentColor));

      if (process.env.DEBUG_WS_TEST) {
        console.error(
          '[turn]',
          guard,
          'actorId(view)=',
          actorId,
          'handLen=',
          hand.length,
          'playable=',
          playable?.id
        );
      }

      if (playable) {
        const chosenColor = playable.kind === 'wild' ? COLORS[0] : undefined;
        actor.send({ type: 'ACTION', action: { type: 'PLAY_CARD', cardId: playable.id, chosenColor } });
      } else {
        actor.send({ type: 'ACTION', action: { type: 'DRAW_CARD' } });
        const afterDraw = await actor.waitForNext((m) => m.type === 'STATE');
        const handAfter: Card[] = afterDraw.type === 'STATE' ? afterDraw.view.yourHand : [];
        const drawnId = afterDraw.type === 'STATE' ? afterDraw.view.yourDrawnCardId : null;
        const drawnCard = handAfter.find((c) => c.id === drawnId);
        if (drawnCard && drawnCard.kind !== 'super' && isPlayable(drawnCard, topCard, currentColor)) {
          const chosenColor = drawnCard.kind === 'wild' ? COLORS[0] : undefined;
          actor.send({ type: 'ACTION', action: { type: 'PLAY_CARD', cardId: drawnCard.id, chosenColor } });
        } else {
          actor.send({ type: 'ACTION', action: { type: 'PASS' } });
        }
      }

      // Just wait for the next STATE this actor receives -- don't assume the turn moved to
      // someone else, since a self-targeting Skip/Reverse in a 2-player game keeps it the same
      // player's turn again immediately.
      const next = await actor.waitForNext((m) => m.type === 'STATE', 5000);
      void nonActor;
      if (next.type === 'STATE') latestView = next.view;

      // The server broadcasts STATE to both sockets independently for the same action; give the
      // *other* player's connection a moment to actually receive theirs too before the next
      // iteration reads their cached hand (otherwise it may read a stale, pre-broadcast state).
      await delay(15);
    }

    expect(latestView.status).toBe('ENDED');
    expect(latestView.winnerId).toBeTruthy();

    host.close();
    guest.close();
  }, 30_000);
});
