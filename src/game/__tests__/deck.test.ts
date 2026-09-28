import { buildDeck } from '../deck/build-deck';
import { mulberry32, shuffle } from '../deck/shuffle';
import { defaultSettings } from '../rules/settings';

describe('buildDeck', () => {
  it('builds a standard 108-card deck when no super cards are enabled', () => {
    const deck = buildDeck({ ...defaultSettings(), enabledSuperCards: [] });
    expect(deck.length).toBe(108);

    const numberCards = deck.filter((c) => c.kind === 'number');
    const actionCards = deck.filter((c) => c.kind === 'action');
    const wildCards = deck.filter((c) => c.kind === 'wild');

    // 4 colors * (one 0 + two of 1-9) = 4 * 19 = 76
    expect(numberCards.length).toBe(76);
    // 4 colors * 3 action types * 2 copies = 24
    expect(actionCards.length).toBe(24);
    // 4 wild + 4 wild4
    expect(wildCards.length).toBe(8);
    expect(wildCards.filter((c) => c.wild === 'wild4').length).toBe(4);
    expect(wildCards.filter((c) => c.wild === 'wild').length).toBe(4);
  });

  it('adds enabled super cards on top of the standard deck', () => {
    const deck = buildDeck({ ...defaultSettings(), enabledSuperCards: ['SWAP'] });
    const swapCards = deck.filter((c) => c.kind === 'super' && c.superType === 'SWAP');
    expect(swapCards.length).toBe(4); // SWAP's copiesInDeck
    expect(deck.length).toBe(108 + 4);
  });

  it('all card ids are unique', () => {
    const deck = buildDeck(defaultSettings());
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(deck.length);
  });
});

describe('shuffle', () => {
  it('is deterministic given the same seed', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = shuffle(items, mulberry32(42));
    const b = shuffle(items, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('does not mutate the input array', () => {
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    shuffle(items, mulberry32(1));
    expect(items).toEqual(copy);
  });

  it('preserves all elements', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = shuffle(items, mulberry32(7));
    expect(shuffled.slice().sort((a, b) => a - b)).toEqual(items);
  });
});
