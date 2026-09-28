import { Buffer } from 'buffer';
import { ClientTransport, ClientTransportHandlers } from '../../client/transport';
import { DecodedFrame, encodeMaskedFrame, OPCODE, tryDecodeFrame } from '../frames';
import { RawServer, RawSocket, RawSocketCallback } from '../raw-socket';
import { ServerTransport } from './types';

/**
 * A fully in-memory `RawSocket` pipe. Two of these, wired together, behave exactly like two ends
 * of a live TCP connection -- writing to one asynchronously (via microtask, to avoid re-entrant
 * handshake bugs) raises a 'data' event on the other.
 */
class LoopbackSocket implements RawSocket {
  private peer: LoopbackSocket | null = null;
  private dataCbs: RawSocketCallback[] = [];
  private closeCbs: RawSocketCallback[] = [];
  private errorCbs: RawSocketCallback[] = [];
  private destroyed = false;

  remoteAddress = '127.0.0.1';

  static createPair(): [LoopbackSocket, LoopbackSocket] {
    const a = new LoopbackSocket();
    const b = new LoopbackSocket();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  write(data: Buffer | Uint8Array | string): void {
    if (this.destroyed || !this.peer) return;
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
    const peer = this.peer;
    queueMicrotask(() => {
      for (const cb of peer.dataCbs) cb(buf);
    });
  }

  end(data?: Buffer | Uint8Array | string): void {
    if (data) this.write(data);
    this.destroy();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const peer = this.peer;
    queueMicrotask(() => {
      for (const cb of this.closeCbs) cb();
      if (peer) for (const cb of peer.closeCbs) cb();
    });
  }

  on(event: 'data' | 'close' | 'error', cb: RawSocketCallback): void {
    if (event === 'data') this.dataCbs.push(cb);
    else if (event === 'close') this.closeCbs.push(cb);
    else if (event === 'error') this.errorCbs.push(cb);
  }
}

/**
 * A `ServerTransport` with no real networking at all: the host's own in-process UI connects to
 * its own game server through this, going through the exact same `GameClient` /
 * `attachWebSocketServer` code paths (handshake, framing, protocol) as a remote player would --
 * just over an in-memory pipe instead of a socket.
 */
export class LoopbackServerTransport implements ServerTransport {
  private connectionListeners: ((socket: RawSocket) => void)[] = [];

  async listen(): Promise<void> {
    // Nothing to bind; loopback is always "listening".
  }

  getRawServer(): RawServer {
    return {
      listen: () => {},
      on: (event, cb) => {
        if (event === 'connection') this.connectionListeners.push(cb as (socket: RawSocket) => void);
      },
      close: (cb) => cb?.(),
    };
  }

  /** Creates a new local client connection and returns the client-side socket to hand to a transport client. */
  connectLocalClient(): RawSocket {
    const [serverSide, clientSide] = LoopbackSocket.createPair();
    for (const cb of this.connectionListeners) cb(serverSide);
    return clientSide;
  }

  async close(): Promise<void> {
    // No-op.
  }
}

function randomBase64Key(): string {
  const bytes = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes.toString('base64');
}

/**
 * `ClientTransport` for the host's own UI: performs a real (if in-memory) WS client handshake
 * and frame masking against a `LoopbackServerTransport`, so it exercises the same wire protocol
 * as `WebSocketClientTransport` without touching the network stack at all.
 */
export class LoopbackClientTransport implements ClientTransport {
  private server: LoopbackServerTransport;
  private socket: RawSocket | null = null;
  private recvBuffer: Buffer = Buffer.alloc(0);
  private handshakeDone = false;

  constructor(server: LoopbackServerTransport) {
    this.server = server;
  }

  connect(handlers: ClientTransportHandlers): void {
    const socket = this.server.connectLocalClient();
    this.socket = socket;
    this.recvBuffer = Buffer.alloc(0);
    this.handshakeDone = false;

    socket.on('data', (chunk) => this.handleData(chunk as Buffer, handlers));
    socket.on('close', () => handlers.onClose(1000, ''));
    socket.on('error', (err) => handlers.onError((err as Error) ?? new Error('socket error')));

    const key = randomBase64Key();
    const request =
      'GET / HTTP/1.1\r\n' +
      'Host: loopback\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Key: ${key}\r\n` +
      'Sec-WebSocket-Version: 13\r\n\r\n';
    socket.write(request);
  }

  private handleData(chunk: Buffer, handlers: ClientTransportHandlers): void {
    this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);

    if (!this.handshakeDone) {
      const headerEnd = this.recvBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      this.recvBuffer = Buffer.from(this.recvBuffer.subarray(headerEnd + 4));
      this.handshakeDone = true;
      handlers.onOpen();
    }

    for (;;) {
      const frame: DecodedFrame | null = tryDecodeFrame(this.recvBuffer);
      if (!frame) return;
      this.recvBuffer = Buffer.from(this.recvBuffer.subarray(frame.byteLength));
      if (frame.opcode === OPCODE.TEXT) {
        handlers.onMessage(frame.payload.toString('utf8'));
      } else if (frame.opcode === OPCODE.CLOSE) {
        handlers.onClose(1000, '');
      }
    }
  }

  send(text: string): void {
    this.socket?.write(encodeMaskedFrame(OPCODE.TEXT, Buffer.from(text, 'utf8')));
  }

  close(): void {
    this.socket?.end();
    this.socket = null;
  }
}
