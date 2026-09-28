import { useSyncExternalStore } from 'react';
import { GameEvent } from '@/game/game-engine/events';
import { PlayerGameView } from '@/game/game-engine/view';
import { ConnectionStatus, GameClient } from './game-client';

export interface ClientStoreSnapshot {
  status: ConnectionStatus;
  view: PlayerGameView | null;
  lastEvents: GameEvent[];
  lastError: { code: string; message: string } | null;
}

/**
 * A tiny external store that mirrors a `GameClient`'s incoming STATE/EVENTS/ERROR/status stream
 * into a plain snapshot object, so `useClientStore` (below) can drive React re-renders via
 * `useSyncExternalStore` without any extra state-management library.
 */
export class ClientStore {
  private snapshot: ClientStoreSnapshot = {
    status: 'idle',
    view: null,
    lastEvents: [],
    lastError: null,
  };
  private listeners = new Set<() => void>();

  constructor(client: GameClient) {
    client.listeners.onStatusChange = (status) => this.update({ status });
    client.listeners.onState = (view) => this.update({ view });
    client.listeners.onEvents = (lastEvents) => this.update({ lastEvents });
    client.listeners.onError = (code, message) => this.update({ lastError: { code, message } });
  }

  private update(partial: Partial<ClientStoreSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ClientStoreSnapshot => this.snapshot;
}

export function useClientStore(store: ClientStore): ClientStoreSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
