import { SuperCardType } from '../cards/types';
import { SuperCardEffect } from './super-card-effect';
import { swapEffect } from './swap';
import {
  discardAllEffect,
  doubleTurnEffect,
  reverseAllEffect,
  shieldEffect,
  stealEffect,
  tradeEffect,
} from './stubs';

export const superCardRegistry: Record<SuperCardType, SuperCardEffect<any>> = {
  SWAP: swapEffect,
  STEAL: stealEffect,
  SHIELD: shieldEffect,
  DOUBLE_TURN: doubleTurnEffect,
  REVERSE_ALL: reverseAllEffect,
  DISCARD_ALL: discardAllEffect,
  TRADE: tradeEffect,
};

export function getSuperCardEffect(type: SuperCardType): SuperCardEffect<any> {
  return superCardRegistry[type];
}
