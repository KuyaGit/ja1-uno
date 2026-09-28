export type Color = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';

export type ActionValue = 'skip' | 'reverse' | 'draw2';
export type WildValue = 'wild' | 'wild4';

export type SuperCardType =
  | 'SWAP'
  | 'STEAL'
  | 'SHIELD'
  | 'DOUBLE_TURN'
  | 'REVERSE_ALL'
  | 'DISCARD_ALL'
  | 'TRADE';

export type CardKind = 'number' | 'action' | 'wild' | 'super';

export interface Card {
  id: string;
  kind: CardKind;
  color?: Color;
  value?: number; // 0-9, only for kind === 'number'
  action?: ActionValue; // only for kind === 'action'
  wild?: WildValue; // only for kind === 'wild'
  superType?: SuperCardType; // only for kind === 'super'
}

export const COLORS: Color[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
