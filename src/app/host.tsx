import * as Network from 'expo-network';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TableColors } from '@/constants/theme';
import { TcpSocketServerTransport } from '@/network/websocket/transports/tcp-socket';
import { useGameSession } from '@/ui/session/game-session';

const HOST_PORT = 3000;

function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

export default function HostScreen() {
  useKeepAwake();
  const { startHosting } = useGameSession();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const roomCode = generateRoomCode();
        const handle = await startHosting(roomCode, HOST_PORT);

        // Also open a real TCP listener so remote phones on the LAN can join. This requires a
        // dev build (react-native-tcp-socket has native code and isn't available in Expo Go).
        try {
          const tcp = new TcpSocketServerTransport();
          await tcp.listen(HOST_PORT, '0.0.0.0');
          handle.server.attach(tcp.getRawServer());
        } catch (tcpErr) {
          console.warn('TCP listener unavailable (requires a dev build):', tcpErr);
        }

        try {
          handle.ip = await Network.getIpAddressAsync();
        } catch {
          handle.ip = null;
        }

        router.replace('/lobby');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start host server.');
      }
    })();
  }, [startHosting]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {error ? (
          <View style={styles.center}>
            <ThemedText style={styles.error}>{error}</ThemedText>
            <Pressable style={styles.button} onPress={() => router.back()}>
              <ThemedText style={styles.buttonText}>Go back</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" size="large" />
            <ThemedText style={styles.status}>Starting server…</ThemedText>
          </View>
        )}
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
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  status: {
    color: '#fff',
  },
  error: {
    color: '#E8433A',
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
