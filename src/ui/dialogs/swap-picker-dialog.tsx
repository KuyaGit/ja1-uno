import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { PublicPlayerView } from '@/game/game-engine/view';
import { ThemedText } from '@/components/themed-text';

export function SwapPickerDialog({
  visible,
  players,
  selfId,
  onPick,
  onCancel,
}: {
  visible: boolean;
  players: PublicPlayerView[];
  selfId: string | null;
  onPick: (targetId: string) => void;
  onCancel: () => void;
}) {
  const targets = players.filter((p) => p.id !== selfId && p.connected && !p.removed);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <View style={styles.sheet}>
          <ThemedText type="subtitle" style={styles.title}>
            SWAP HANDS
          </ThemedText>
          <ThemedText style={styles.subtitle}>Choose a player</ThemedText>
          <FlatList
            data={targets}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onPick(item.id)}>
                <ThemedText style={styles.rowAvatar}>{item.avatar}</ThemedText>
                <ThemedText style={styles.rowName}>{item.name}</ThemedText>
                <ThemedText style={styles.rowCount}>{item.handCount} cards</ThemedText>
              </Pressable>
            )}
          />
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
    gap: 12,
    minWidth: 260,
    maxHeight: 400,
  },
  title: {
    color: '#B76BFF',
    textAlign: 'center',
  },
  subtitle: {
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  rowAvatar: {
    fontSize: 22,
  },
  rowName: {
    color: '#fff',
    flex: 1,
    fontWeight: '600',
  },
  rowCount: {
    color: '#aaa',
  },
});
