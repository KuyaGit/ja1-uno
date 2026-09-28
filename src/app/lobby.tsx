import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TableColors } from '@/constants/theme';
import { ConnectionBanner } from '@/ui/dialogs/connection-banner';
import { PlayerRow } from '@/ui/lobby/player-row';
import { useGameSession, useGameSessionState } from '@/ui/session/game-session';

export default function LobbyScreen() {
  const { isHost, hostHandle, sendAction, leaveSession, client } = useGameSession();
  const { status, view } = useGameSessionState();

  useEffect(() => {
    if (view?.status === 'PLAYING') {
      router.replace('/game');
    }
  }, [view?.status]);

  useEffect(() => {
    if (status === 'disconnected') {
      leaveSession();
      router.replace('/');
    }
  }, [status, leaveSession]);

  if (!view) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText style={styles.status}>Connecting…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const self = view.players.find((p) => p.id === client?.playerId);
  const canStart = isHost && view.players.length >= 2;
  const qrValue = hostHandle?.ip
    ? `ja1uno://join?h=${hostHandle.ip}&p=${hostHandle.port}&r=${view.roomCode}`
    : null;

  return (
    <ThemedView style={styles.container}>
      <ConnectionBanner status={status} />
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Lobby
        </ThemedText>
        <ThemedText style={styles.roomCode}>{view.roomCode}</ThemedText>

        {isHost && (
          <View style={styles.qrBlock}>
            {qrValue ? (
              <QRCode value={qrValue} size={140} backgroundColor="transparent" color="#fff" />
            ) : (
              <ThemedText style={styles.hint}>Fetching IP address…</ThemedText>
            )}
            {hostHandle?.ip && (
              <ThemedText style={styles.ipText}>
                {hostHandle.ip}:{hostHandle.port}
              </ThemedText>
            )}
          </View>
        )}

        <ThemedText style={styles.count}>
          {view.players.length} / {view.settings.maxPlayers} players
        </ThemedText>

        <FlatList
          style={styles.list}
          data={view.players}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PlayerRow player={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />

        <View style={styles.actions}>
          {!self?.isHost && (
            <Pressable
              style={styles.button}
              onPress={() => sendAction({ type: 'SET_READY', ready: !self?.ready })}>
              <ThemedText style={styles.buttonText}>{self?.ready ? 'NOT READY' : "I'M READY"}</ThemedText>
            </Pressable>
          )}
          {isHost && (
            <Pressable
              disabled={!canStart}
              style={[styles.button, styles.primary, !canStart && styles.disabled]}
              onPress={() => sendAction({ type: 'START_GAME' })}>
              <ThemedText style={styles.buttonText}>START GAME</ThemedText>
            </Pressable>
          )}
          <Pressable
            style={styles.buttonGhost}
            onPress={() => {
              leaveSession();
              router.replace('/');
            }}>
            <ThemedText style={styles.buttonGhostText}>Leave</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TableColors.feltDark,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  status: {
    color: '#fff',
  },
  title: {
    color: '#fff',
  },
  roomCode: {
    color: '#F2B705',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
  },
  qrBlock: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    borderRadius: 16,
  },
  ipText: {
    color: '#ccc',
    fontSize: 12,
  },
  hint: {
    color: '#ccc',
  },
  count: {
    color: '#aad9bb',
  },
  list: {
    alignSelf: 'stretch',
    flex: 1,
  },
  actions: {
    alignSelf: 'stretch',
    gap: 10,
    paddingBottom: 16,
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
  disabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonGhost: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  buttonGhostText: {
    color: '#E8433A',
    fontWeight: '600',
  },
});
