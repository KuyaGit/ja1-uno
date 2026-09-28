import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Color, COLORS } from '@/game/cards/types';
import { CardColors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export function ColorPickerDialog({
  visible,
  onPick,
  onCancel,
}: {
  visible: boolean;
  onPick: (color: Color) => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <View style={styles.sheet}>
          <ThemedText type="subtitle" style={styles.title}>
            Choose a color
          </ThemedText>
          <View style={styles.grid}>
            {COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => onPick(color)}
                style={[styles.swatch, { backgroundColor: CardColors[color] }]}
              />
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: '#1b1b1f',
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  title: {
    color: '#fff',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    gap: 14,
  },
  swatch: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
