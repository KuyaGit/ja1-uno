import { Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/game/cards/types';
import { CardColors, SuperCardAccent, TableColors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export interface CardViewProps {
  card: Card;
  dimmed?: boolean;
  selected?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

const SIZES = {
  small: { width: 44, height: 64, font: 14 },
  medium: { width: 64, height: 92, font: 20 },
  large: { width: 84, height: 122, font: 26 },
};

function labelFor(card: Card): string {
  switch (card.kind) {
    case 'number':
      return String(card.value);
    case 'action':
      return { skip: '⦸', reverse: '⇄', draw2: '+2' }[card.action!];
    case 'wild':
      return card.wild === 'wild4' ? '+4' : '★';
    case 'super':
      return '★';
  }
}

export function CardView({ card, dimmed, selected, size = 'medium', onPress }: CardViewProps) {
  const dims = SIZES[size];
  const isSuper = card.kind === 'super';
  const bg = isSuper
    ? TableColors.cardBack
    : card.kind === 'wild'
      ? TableColors.cardBack
      : card.color
        ? CardColors[card.color]
        : TableColors.cardBack;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.card,
        { width: dims.width, height: dims.height, backgroundColor: bg },
        isSuper && styles.superCard,
        selected && styles.selected,
        dimmed && styles.dimmed,
      ]}>
      <View style={styles.inner}>
        <ThemedText style={[styles.label, { fontSize: dims.font, color: isSuper ? SuperCardAccent : '#fff' }]}>
          {labelFor(card)}
        </ThemedText>
        {isSuper && <ThemedText style={styles.badge}>★</ThemedText>}
      </View>
    </Pressable>
  );
}

export function CardBack({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const dims = SIZES[size];
  return (
    <View style={[styles.card, styles.cardBack, { width: dims.width, height: dims.height }]}>
      <ThemedText style={[styles.backGlyph, { fontSize: dims.font }]}>UNO</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  superCard: {
    borderColor: SuperCardAccent,
    borderWidth: 3,
  },
  selected: {
    transform: [{ translateY: -10 }],
    borderColor: '#fff',
  },
  dimmed: {
    opacity: 0.35,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
  },
  badge: {
    color: SuperCardAccent,
    position: 'absolute',
    top: -4,
    right: -4,
    fontSize: 10,
  },
  cardBack: {
    backgroundColor: TableColors.cardBack,
    borderColor: '#fff',
  },
  backGlyph: {
    color: '#fff',
    fontWeight: '800',
  },
});
