import { Card, Color } from './types';

/** Whether `card` can legally be played on top of `topCard`, given the active color. */
export function isPlayable(card: Card, topCard: Card, currentColor: Color | undefined): boolean {
  if (card.kind === 'wild') return true;
  if (card.kind === 'super') return true;

  if (currentColor && card.color === currentColor) return true;

  if (topCard.kind === 'number' && card.kind === 'number') {
    return card.value === topCard.value;
  }
  if (topCard.kind === 'action' && card.kind === 'action') {
    return card.action === topCard.action;
  }
  return false;
}

export function cardLabel(card: Card): string {
  switch (card.kind) {
    case 'number':
      return `${card.color ?? ''} ${card.value}`.trim();
    case 'action':
      return `${card.color ?? ''} ${card.action}`.trim();
    case 'wild':
      return card.wild === 'wild4' ? 'Wild Draw 4' : 'Wild';
    case 'super':
      return `Super: ${card.superType}`;
  }
}

export function isWildDraw4(card: Card): boolean {
  return card.kind === 'wild' && card.wild === 'wild4';
}

export function isSuper(card: Card): boolean {
  return card.kind === 'super';
}
