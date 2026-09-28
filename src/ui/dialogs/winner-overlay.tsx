import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

export function WinnerOverlay({
  visible,
  winnerName,
  isHost,
  onPlayAgain,
  onReturnToLobby,
}: {
  visible: boolean;
  winnerName: string | null;
  isHost: boolean;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ThemedText style={styles.emoji}>🎉</ThemedText>
          <ThemedText type="title" style={styles.title}>
            WINNER!
          </ThemedText>
          <ThemedText type="subtitle" style={styles.name}>
            {winnerName ?? 'Someone'}
          </ThemedText>
          <View style={styles.buttons}>
            {isHost && (
              <Pressable style={[styles.button, styles.primary]} onPress={onPlayAgain}>
                <ThemedText style={styles.buttonText}>PLAY AGAIN</ThemedText>
              </Pressable>
            )}
            <Pressable style={styles.button} onPress={onReturnToLobby}>
              <ThemedText style={styles.buttonText}>RETURN TO LOBBY</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: '#1b1b1f',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    minWidth: 280,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    color: '#F2B705',
    fontSize: 34,
  },
  name: {
    color: '#fff',
    marginBottom: 16,
  },
  buttons: {
    gap: 12,
    alignSelf: 'stretch',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#2AA34A',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
