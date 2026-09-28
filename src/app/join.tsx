import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TableColors } from '@/constants/theme';
import { useGameSession } from '@/ui/session/game-session';

/** ja1uno://join?h=IP&p=3000&r=ROOMCODE */
function parseJoinUrl(url: string): { host: string; port: number; roomCode: string } | null {
  try {
    const match = url.match(/^ja1uno:\/\/join\?(.+)$/);
    const query = match ? match[1] : url.includes('?') ? url.split('?')[1] : null;
    if (!query) return null;
    const params = new URLSearchParams(query);
    const host = params.get('h');
    const port = Number(params.get('p'));
    const roomCode = params.get('r');
    if (!host || !port || !roomCode) return null;
    return { host, port, roomCode: roomCode.toUpperCase() };
  } catch {
    return null;
  }
}

export default function JoinScreen() {
  const { joinRemote } = useGameSession();
  const [mode, setMode] = useState<'manual' | 'scan'>('manual');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3000');
  const [roomCode, setRoomCode] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  function connect(host: string, portNum: number, code: string) {
    joinRemote(code.toUpperCase(), host, portNum);
    router.replace('/lobby');
  }

  function submitManual() {
    const portNum = Number(port) || 3000;
    if (!ip.trim() || !roomCode.trim()) return;
    connect(ip.trim(), portNum, roomCode.trim());
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Join a game
        </ThemedText>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, mode === 'manual' && styles.tabActive]}
            onPress={() => setMode('manual')}>
            <ThemedText style={styles.tabText}>Enter code</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'scan' && styles.tabActive]}
            onPress={() => setMode('scan')}>
            <ThemedText style={styles.tabText}>Scan QR</ThemedText>
          </Pressable>
        </View>

        {mode === 'manual' ? (
          <View style={styles.form}>
            <TextInput
              value={ip}
              onChangeText={setIp}
              placeholder="Host IP address (e.g. 192.168.1.23)"
              placeholderTextColor="#888"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={port}
              onChangeText={setPort}
              placeholder="Port"
              placeholderTextColor="#888"
              keyboardType="number-pad"
              style={styles.input}
            />
            <TextInput
              value={roomCode}
              onChangeText={setRoomCode}
              placeholder="Room code"
              placeholderTextColor="#888"
              autoCapitalize="characters"
              maxLength={4}
              style={styles.input}
            />
            <Pressable style={styles.button} onPress={submitManual}>
              <ThemedText style={styles.buttonText}>CONNECT</ThemedText>
            </Pressable>
          </View>
        ) : Platform.OS === 'web' ? (
          <ThemedText style={styles.hint}>Camera scanning isn&apos;t available on web -- use Enter code instead.</ThemedText>
        ) : !permission ? (
          <ThemedText style={styles.hint}>Checking camera permission…</ThemedText>
        ) : !permission.granted ? (
          <View style={styles.form}>
            <ThemedText style={styles.hint}>Camera access is needed to scan the host&apos;s QR code.</ThemedText>
            <Pressable style={styles.button} onPress={requestPermission}>
              <ThemedText style={styles.buttonText}>GRANT PERMISSION</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.scannerWrap}>
            <CameraView
              style={styles.scanner}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(result) => {
                if (scanned) return;
                const parsed = parseJoinUrl(result.data);
                if (parsed) {
                  setScanned(true);
                  connect(parsed.host, parsed.port, parsed.roomCode);
                }
              }}
            />
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
    paddingTop: 32,
    paddingHorizontal: 24,
    gap: 20,
  },
  title: {
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tabText: {
    color: '#fff',
    fontWeight: '600',
  },
  form: {
    alignSelf: 'stretch',
    gap: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2AA34A',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  hint: {
    color: '#ccc',
    textAlign: 'center',
  },
  scannerWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scanner: {
    flex: 1,
  },
});
