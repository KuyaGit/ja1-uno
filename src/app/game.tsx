import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isPlayable } from '@/game/cards/card-utils';
import { Card, Color } from '@/game/cards/types';
import { CardColors, TableColors } from '@/constants/theme';
import { CardBack, CardView } from '@/ui/cards/card-view';
import { ColorPickerDialog } from '@/ui/dialogs/color-picker-dialog';
import { ConnectionBanner } from '@/ui/dialogs/connection-banner';
import { SwapPickerDialog } from '@/ui/dialogs/swap-picker-dialog';
import { WinnerOverlay } from '@/ui/dialogs/winner-overlay';
import { useGameSession, useGameSessionState } from '@/ui/session/game-session';

export default function GameScreen() {
  const { isHost, sendAction, leaveSession, client } = useGameSession();
  const { status, view, lastError } = useGameSessionState();

  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);
  const [pendingSwapCardId, setPendingSwapCardId] = useState<string | null>(null);
  const lastTurnPlayerRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'disconnected') {
      leaveSession();
      router.replace('/');
    }
  }, [status, leaveSession]);

  useEffect(() => {
    if (!view) return;
    if (view.currentPlayerId && view.currentPlayerId !== lastTurnPlayerRef.current) {
      lastTurnPlayerRef.current = view.currentPlayerId;
      if (view.currentPlayerId === client?.playerId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
  }, [view, client?.playerId]);

  useEffect(() => {
    if (lastError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [lastError]);

  if (!view) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText style={styles.centerText}>Connecting…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const selfId = client?.playerId ?? null;
  const isMyTurn = view.currentPlayerId === selfId;
  const opponents = view.players.filter((p) => p.id !== selfId);
  const topCard = view.discardTop;
  const winner = view.status === 'ENDED' ? view.players.find((p) => p.id === view.winnerId) : null;

  function attemptPlay(card: Card) {
    if (!isMyTurn || !view) return;
    if (card.kind === 'super') {
      if (card.superType === 'SWAP') {
        setPendingSwapCardId(card.id);
      } else {
        sendAction({ type: 'USE_SUPER_CARD', cardId: card.id });
      }
      return;
    }
    if (!topCard || !isPlayable(card, topCard, view.currentColor ?? undefined)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    if (card.kind === 'wild') {
      setPendingWildCardId(card.id);
      return;
    }
    sendAction({ type: 'PLAY_CARD', cardId: card.id });
  }

  function pickColor(color: Color) {
    if (pendingWildCardId) {
      sendAction({ type: 'PLAY_CARD', cardId: pendingWildCardId, chosenColor: color });
      setPendingWildCardId(null);
    }
  }

  function pickSwapTarget(targetId: string) {
    if (pendingSwapCardId) {
      sendAction({ type: 'USE_SUPER_CARD', cardId: pendingSwapCardId, targetPlayerId: targetId });
      setPendingSwapCardId(null);
    }
  }

  const canDraw = isMyTurn && !view.yourDrawnCardId;
  const canPass = isMyTurn && !!view.yourDrawnCardId;
  const canCallUno = view.yourHand.length <= 2 && view.yourHand.length >= 1;
  const catchTarget = view.unoVulnerableId && view.unoVulnerableId !== selfId ? view.unoVulnerableId : null;

  return (
    <ThemedView style={styles.container}>
      <ConnectionBanner status={status} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.opponentRow}>
          {opponents.map((p) => (
            <View
              key={p.id}
              style={[styles.opponent, view.currentPlayerId === p.id && styles.opponentActive]}>
              <ThemedText style={styles.opponentAvatar}>{p.avatar}</ThemedText>
              <ThemedText style={styles.opponentName} numberOfLines={1}>
                {p.name}
              </ThemedText>
              <View style={styles.opponentHand}>
                <CardBack size="small" />
                <ThemedText style={styles.opponentCount}>{p.handCount}</ThemedText>
              </View>
              {!p.connected && <ThemedText style={styles.disconnectedTag}>offline</ThemedText>}
              {view.unoVulnerableId === p.id && <ThemedText style={styles.unoTag}>UNO!</ThemedText>}
            </View>
          ))}
        </ScrollView>

        <View style={styles.center}>
          <View style={styles.pileRow}>
            <View style={styles.pileCol}>
              <Pressable disabled={!canDraw} onPress={() => sendAction({ type: 'DRAW_CARD' })}>
                <CardBack size="large" />
              </Pressable>
              <ThemedText style={styles.pileLabel}>{view.drawPileCount} left</ThemedText>
            </View>
            <View style={styles.pileCol}>
              {topCard && <CardView card={topCard} size="large" />}
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: view.currentColor ? CardColors[view.currentColor] : '#555' },
                ]}
              />
            </View>
          </View>

          <View style={styles.actionRow}>
            {canPass && (
              <Pressable style={styles.smallButton} onPress={() => sendAction({ type: 'PASS' })}>
                <ThemedText style={styles.smallButtonText}>PASS</ThemedText>
              </Pressable>
            )}
            {canCallUno && (
              <Pressable style={[styles.smallButton, styles.uno]} onPress={() => sendAction({ type: 'CALL_UNO' })}>
                <ThemedText style={styles.smallButtonText}>UNO!</ThemedText>
              </Pressable>
            )}
            {catchTarget && (
              <Pressable
                style={[styles.smallButton, styles.catchBtn]}
                onPress={() => sendAction({ type: 'CATCH_UNO', targetId: catchTarget })}>
                <ThemedText style={styles.smallButtonText}>CATCH!</ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.handRow} contentContainerStyle={styles.handContent}>
          {view.yourHand.map((card) => {
            const playable =
              isMyTurn &&
              (card.kind === 'super' || (topCard ? isPlayable(card, topCard, view.currentColor ?? undefined) : false));
            return (
              <View key={card.id} style={styles.handCardWrap}>
                <CardView card={card} size="medium" dimmed={isMyTurn && !playable} onPress={() => attemptPlay(card)} />
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      <ColorPickerDialog visible={!!pendingWildCardId} onPick={pickColor} onCancel={() => setPendingWildCardId(null)} />
      <SwapPickerDialog
        visible={!!pendingSwapCardId}
        players={view.players}
        selfId={selfId}
        onPick={pickSwapTarget}
        onCancel={() => setPendingSwapCardId(null)}
      />
      <WinnerOverlay
        visible={!!winner}
        winnerName={winner?.name ?? null}
        isHost={isHost}
        onPlayAgain={() => sendAction({ type: 'RESTART' })}
        onReturnToLobby={() => router.replace('/lobby')}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TableColors.felt,
  },
  safeArea: {
    flex: 1,
  },
  centerText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 40,
  },
  opponentRow: {
    maxHeight: 96,
    paddingVertical: 8,
  },
  opponent: {
    alignItems: 'center',
    marginHorizontal: 8,
    padding: 8,
    borderRadius: 12,
    minWidth: 72,
  },
  opponentActive: {
    borderWidth: 2,
    borderColor: '#F2B705',
  },
  opponentAvatar: {
    fontSize: 22,
  },
  opponentName: {
    color: '#fff',
    fontSize: 11,
    maxWidth: 70,
  },
  opponentHand: {
    alignItems: 'center',
  },
  opponentCount: {
    color: '#ccc',
    fontSize: 11,
  },
  disconnectedTag: {
    color: '#E8433A',
    fontSize: 9,
  },
  unoTag: {
    color: '#F2B705',
    fontSize: 10,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  pileRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
  },
  pileCol: {
    alignItems: 'center',
    gap: 6,
  },
  pileLabel: {
    color: '#ccc',
    fontSize: 11,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  uno: {
    backgroundColor: '#F2B705',
  },
  catchBtn: {
    backgroundColor: '#E8433A',
  },
  smallButtonText: {
    color: '#141414',
    fontWeight: '800',
  },
  handRow: {
    maxHeight: 140,
  },
  handContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    alignItems: 'center',
  },
  handCardWrap: {
    marginRight: -20,
  },
});
