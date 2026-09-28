import * as Crypto from 'expo-crypto';
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { GameAction } from '@/game/game-engine/actions';
import { GameEvent } from '@/game/game-engine/events';
import { GameClient } from '@/network/client/game-client';
import { ClientStore, ClientStoreSnapshot } from '@/network/client/client-store';
import { ClientTransport, WebSocketClientTransport } from '@/network/client/transport';
import { HostServer } from '@/network/room-server/host-server';
import { LoopbackClientTransport, LoopbackServerTransport } from '@/network/websocket/transports/loopback';
import { getPlayerAvatar, getPlayerName, getSessionToken, setPlayerAvatar, setPlayerName, setSessionToken } from '@/ui/storage/kv-store';

export interface HostHandle {
  server: HostServer;
  loopback: LoopbackServerTransport;
  ip: string | null;
  port: number;
}

interface GameSessionContextValue {
  playerName: string;
  playerAvatar: string;
  setIdentity: (name: string, avatar: string) => void;

  roomCode: string | null;
  isHost: boolean;
  hostHandle: HostHandle | null;

  client: GameClient | null;
  clientStore: ClientStore | null;

  /** Starts a local host server + connects this device's own client to it via loopback. */
  startHosting: (roomCode: string, port: number) => Promise<HostHandle>;
  /** Connects as a remote client to some other device's host over the network. */
  joinRemote: (roomCode: string, hostIp: string, port: number) => void;
  /** Tears down whatever session (host and/or client) is currently active. */
  leaveSession: () => void;

  sendAction: (action: GameAction) => void;
}

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const [playerName, setPlayerNameState] = useState(() => getPlayerName() ?? '');
  const [playerAvatar, setPlayerAvatarState] = useState(() => getPlayerAvatar() ?? '🦄');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [hostHandle, setHostHandle] = useState<HostHandle | null>(null);
  const [client, setClient] = useState<GameClient | null>(null);
  const [clientStore, setClientStore] = useState<ClientStore | null>(null);
  const hostHandleRef = useRef<HostHandle | null>(null);

  const setIdentity = useCallback((name: string, avatar: string) => {
    setPlayerNameState(name);
    setPlayerAvatarState(avatar);
    setPlayerName(name);
    setPlayerAvatar(avatar);
  }, []);

  const leaveSession = useCallback(() => {
    client?.disconnect();
    hostHandleRef.current?.server.stop();
    hostHandleRef.current = null;
    setHostHandle(null);
    setClient(null);
    setClientStore(null);
    setRoomCode(null);
    setIsHost(false);
  }, [client]);

  const connectClient = useCallback(
    (code: string, createTransport: () => ClientTransport) => {
      const newClient = new GameClient({
        roomCode: code,
        name: playerName || 'Player',
        avatar: playerAvatar || '🙂',
        getSessionToken: () => getSessionToken(code),
        setSessionToken: (token) => setSessionToken(code, token),
        createTransport,
        listeners: {},
      });
      const store = new ClientStore(newClient);
      newClient.connect();
      setClient(newClient);
      setClientStore(store);
      setRoomCode(code);
    },
    [playerName, playerAvatar]
  );

  const startHosting = useCallback(
    async (code: string, port: number): Promise<HostHandle> => {
      const loopback = new LoopbackServerTransport();
      const hostSessionToken = Crypto.randomUUID();
      const server = new HostServer({
        roomCode: code,
        hostId: Crypto.randomUUID(),
        hostName: playerName || 'Host',
        hostAvatar: playerAvatar || '🦄',
        hostSessionToken,
      });
      server.attach(loopback.getRawServer());
      server.start();
      setSessionToken(code, hostSessionToken);

      const handle: HostHandle = { server, loopback, ip: null, port };
      hostHandleRef.current = handle;
      setHostHandle(handle);
      setIsHost(true);

      connectClient(code, () => new LoopbackClientTransport(loopback));
      return handle;
    },
    [connectClient, playerName, playerAvatar]
  );

  const joinRemote = useCallback(
    (code: string, hostIp: string, port: number) => {
      setIsHost(false);
      connectClient(code, () => new WebSocketClientTransport(`ws://${hostIp}:${port}`));
    },
    [connectClient]
  );

  const sendAction = useCallback(
    (action: GameAction) => {
      client?.send(action);
    },
    [client]
  );

  const value = useMemo<GameSessionContextValue>(
    () => ({
      playerName,
      playerAvatar,
      setIdentity,
      roomCode,
      isHost,
      hostHandle,
      client,
      clientStore,
      startHosting,
      joinRemote,
      leaveSession,
      sendAction,
    }),
    [
      playerName,
      playerAvatar,
      setIdentity,
      roomCode,
      isHost,
      hostHandle,
      client,
      clientStore,
      startHosting,
      joinRemote,
      leaveSession,
      sendAction,
    ]
  );

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession(): GameSessionContextValue {
  const ctx = useContext(GameSessionContext);
  if (!ctx) throw new Error('useGameSession must be used within a GameSessionProvider');
  return ctx;
}

const IDLE_SNAPSHOT: ClientStoreSnapshot = { status: 'idle', view: null, lastEvents: [], lastError: null };
const noopSubscribe = () => () => {};

/** Convenience hook: the live client snapshot (status/view/events/error), or an idle snapshot if not connected. */
export function useGameSessionState(): ClientStoreSnapshot {
  const { clientStore } = useGameSession();
  return useSyncExternalStore(
    clientStore ? clientStore.subscribe : noopSubscribe,
    clientStore ? clientStore.getSnapshot : () => IDLE_SNAPSHOT
  );
}

export type { GameEvent };
