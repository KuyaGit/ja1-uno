import { StyleSheet, View } from 'react-native';
import { PublicPlayerView } from '@/game/game-engine/view';
import { ThemedText } from '@/components/themed-text';

export function PlayerRow({ player }: { player: PublicPlayerView }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.avatar}>{player.avatar}</ThemedText>
      <View style={styles.info}>
        <ThemedText style={styles.name}>
          {player.name} {player.isHost ? '(Host)' : ''}
        </ThemedText>
        {!player.connected && <ThemedText style={styles.disconnected}>disconnected</ThemedText>}
      </View>
      <ThemedText style={[styles.ready, player.ready && styles.readyOn]}>
        {player.ready ? 'READY' : 'WAITING'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    fontSize: 26,
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontWeight: '600',
  },
  disconnected: {
    color: '#E8433A',
    fontSize: 12,
  },
  ready: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
  },
  readyOn: {
    color: '#2AA34A',
  },
});
