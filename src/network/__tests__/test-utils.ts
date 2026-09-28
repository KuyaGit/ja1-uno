import WebSocket from 'ws';
import { mulberry32 } from '@/game/deck/shuffle';
import { HostServer, HostServerOptions } from '../room-server/host-server';
import { NodeNetServerTransport } from '../websocket/transports/node-net';
import { HostMessage, PROTOCOL_VERSION } from '../messages/protocol';

let idCounter = 0;
export function nextTestId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export interface TestServer {
  server: HostServer;
  transport: NodeNetServerTransport;
  port: number;
  hostToken: string;
  close: () => Promise<void>;
}

export async function startTestServer(overrides: Partial<HostServerOptions> = {}): Promise<TestServer> {
  const transport = new NodeNetServerTransport();
  const server = new HostServer({
    roomCode: 'ROOM1',
    hostId: 'host-player',
    hostName: 'Host',
    hostAvatar: '🦄',
    rng: mulberry32(42),
    generateId: () => nextTestId('gen'),
    ...overrides,
  });
  server.attach(transport.getRawServer());
  server.start();
  await transport.listen(0, '127.0.0.1');
  const port = transport.address()!.port;
  return {
    server,
    transport,
    port,
    hostToken: server.getHostSessionToken(),
    close: async () => {
      server.stop();
      await transport.close();
    },
  };
}

export class TestClient {
  ws: WebSocket;
  messages: HostMessage[] = [];
  private waiters: { predicate: (m: HostMessage) => boolean; resolve: (m: HostMessage) => void }[] = [];
  closedCode: number | null = null;

  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as HostMessage;
      this.messages.push(msg);
      if (process.env.DEBUG_WS_TEST && msg.type === 'ERROR') {
        console.error('[TestClient ERROR]', JSON.stringify(msg));
      }
      this.waiters = this.waiters.filter((w) => {
        if (w.predicate(msg)) {
          w.resolve(msg);
          return false;
        }
        return true;
      });
    });
    this.ws.on('close', (code) => {
      this.closedCode = code;
    });
  }

  waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  waitFor(predicate: (m: HostMessage) => boolean, timeoutMs = 2000): Promise<HostMessage> {
    const existing = this.messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return this.waitForNext(predicate, timeoutMs);
  }

  /** Like `waitFor`, but never resolves from the already-buffered message log -- only a message
   * that arrives after this call satisfies it. Use this when polling for state *changes* (e.g.
   * "the turn moved on"), where an old cached message could otherwise match the predicate. */
  waitForNext(predicate: (m: HostMessage) => boolean, timeoutMs = 2000): Promise<HostMessage> {
    return new Promise((resolve, reject) => {
      const entry: { predicate: (m: HostMessage) => boolean; resolve: (m: HostMessage) => void } = {
        predicate,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      };
      const timer = setTimeout(() => {
        // Remove this waiter so it can't silently "steal" a later matching message.
        this.waiters = this.waiters.filter((w) => w !== entry);
        reject(new Error('waitForNext timed out'));
      }, timeoutMs);
      this.waiters.push(entry);
    });
  }

  waitForClose(timeoutMs = 2000): Promise<number> {
    if (this.closedCode !== null) return Promise.resolve(this.closedCode);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('waitForClose timed out')), timeoutMs);
      this.ws.once('close', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
  }

  async hello(roomCode: string, name: string, avatar: string, sessionToken?: string): Promise<HostMessage> {
    await this.waitForOpen();
    this.send({ type: 'HELLO', v: PROTOCOL_VERSION, roomCode, name, avatar, sessionToken });
    return this.waitFor((m) => m.type === 'WELCOME' || m.type === 'ERROR');
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    this.ws.close();
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
