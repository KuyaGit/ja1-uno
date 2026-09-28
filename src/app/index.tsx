import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TableColors } from '@/constants/theme';
import { useGameSession } from '@/ui/session/game-session';

const AVATARS = ['🦄', '🐸', '🐼', '🦊', '🐯', '🐵', '🦁', '🐙', '🐲', '🤖', '👾', '🎃'];

export default function HomeScreen() {
  const { playerName, playerAvatar, setIdentity } = useGameSession();
  const [name, setName] = useState(playerName);
  const [avatar, setAvatar] = useState(playerAvatar);

  const canContinue = name.trim().length > 0;

  function commitIdentity() {
    setIdentity(name.trim(), avatar);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          UNO Local
        </ThemedText>
        <ThemedText type="small" style={styles.subtitle}>
          Local WiFi multiplayer, no internet required
        </ThemedText>

        <View style={styles.avatarPreview}>
          <ThemedText style={styles.avatarBig}>{avatar}</ThemedText>
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor="#888"
          style={styles.input}
          maxLength={16}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarRow}>
          {AVATARS.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAvatar(a)}
              style={[styles.avatarChip, a === avatar && styles.avatarChipSelected]}>
              <ThemedText style={styles.avatarChipText}>{a}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            disabled={!canContinue}
            style={[styles.button, styles.primary, !canContinue && styles.disabled]}
            onPress={() => {
              commitIdentity();
              router.push('/host');
            }}>
            <ThemedText style={styles.buttonText}>HOST GAME</ThemedText>
          </Pressable>
          <Pressable
            disabled={!canContinue}
            style={[styles.button, !canContinue && styles.disabled]}
            onPress={() => {
              commitIdentity();
              router.push('/join');
            }}>
            <ThemedText style={styles.buttonText}>JOIN GAME</ThemedText>
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
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    color: '#aad9bb',
    textAlign: 'center',
    marginBottom: 8,
  },
  avatarPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarBig: {
    fontSize: 48,
  },
  input: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  avatarRow: {
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  avatarChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarChipSelected: {
    borderWidth: 2,
    borderColor: '#F2B705',
  },
  avatarChipText: {
    fontSize: 24,
  },
  actions: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    fontSize: 16,
  },
});
