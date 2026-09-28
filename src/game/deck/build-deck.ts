import { Card, COLORS } from '../cards/types';
import { getSuperCardEffect } from '../effects/registry';
import { GameSettings } from '../rules/settings';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Resets the module-local id counter. Only meant for deterministic tests. */
export function resetCardIdCounterForTests(): void {
  idCounter = 0;
}

/** Builds the standard 108-card UNO deck, plus any enabled super cards. */
export function buildDeck(settings: GameSettings): Card[] {
  const cards: Card[] = [];

  for (const color of COLORS) {
    cards.push({ id: nextId('c'), kind: 'number', color, value: 0 });
    for (let copy = 0; copy < 2; copy++) {
      for (let value = 1; value <= 9; value++) {
        cards.push({ id: nextId('c'), kind: 'number', color, value });
      }
      for (const action of ['skip', 'reverse', 'draw2'] as const) {
        cards.push({ id: nextId('c'), kind: 'action', color, action });
      }
    }
  }

  for (let i = 0; i < 4; i++) {
    cards.push({ id: nextId('c'), kind: 'wild', wild: 'wild' });
    cards.push({ id: nextId('c'), kind: 'wild', wild: 'wild4' });
  }

  for (const type of settings.enabledSuperCards) {
    const effect = getSuperCardEffect(type);
    for (let i = 0; i < effect.copiesInDeck; i++) {
      cards.push({ id: nextId('s'), kind: 'super', superType: type });
    }
  }

  return cards;
}
