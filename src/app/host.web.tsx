import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TableColors } from '@/constants/theme';

/** Web fallback: hosting needs a raw TCP listen socket (react-native-tcp-socket), which has no
 * web implementation. Only native builds (dev client / standalone) can host a room. */
export default function HostWebFallback() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ThemedText style={styles.emoji}>🚫</ThemedText>
          <ThemedText type="subtitle" style={styles.title}>
            Hosting isn&apos;t supported on web
          </ThemedText>
          <ThemedText style={styles.body}>
            UNO Local hosts a game by opening a real TCP server on your device, which browsers
            can&apos;t do. Install the app on a phone (a development build or standalone build) to
            host a game. You can still join a game hosted by someone else from this browser.
          </ThemedText>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <ThemedText style={styles.buttonText}>Go back</ThemedText>
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
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 420,
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    color: '#fff',
    textAlign: 'center',
  },
  body: {
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 8,
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
