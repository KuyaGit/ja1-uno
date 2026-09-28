import { StyleSheet, View } from 'react-native';
import { ConnectionStatus } from '@/network/client/game-client';
import { ThemedText } from '@/components/themed-text';

const LABELS: Record<ConnectionStatus, string | null> = {
  idle: null,
  connecting: 'Connecting…',
  connected: null,
  reconnecting: 'Connection lost… Reconnecting…',
  disconnected: 'Connection lost. Returning home…',
};

/** Small top banner shown while (re)connecting; renders nothing once stably connected. */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  const label = LABELS[status];
  if (!label) return null;

  return (
    <View style={[styles.banner, status === 'disconnected' && styles.error]}>
      <ThemedText style={styles.text}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F2B705',
    paddingVertical: 6,
    alignItems: 'center',
  },
  error: {
    backgroundColor: '#E8433A',
  },
  text: {
    color: '#141414',
    fontWeight: '700',
    fontSize: 13,
  },
});
