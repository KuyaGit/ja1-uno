import { Buffer } from 'buffer';
import { computeAcceptKey } from './sha1';
import {
  DecodedFrame,
  encodeCloseFrame,
  encodePongFrame,
  encodeTextFrame,
  OPCODE,
  tryDecodeFrame,
} from './frames';
import { RawServer, RawSocket } from './raw-socket';

type ConnectionListener = (socket: RawSocket) => void;

type Listener<Args extends unknown[]> = (...args: Args) => void;

/** A single accepted, handshaken WebSocket connection. */
export class WSConnection {
  private socket: RawSocket;
  private recvBuffer: Buffer = Buffer.alloc(0);
  private fragmentOpcode: number | null = null;
  private fragmentChunks: Buffer[] = [];
  private closed = false;

  private messageListeners: Listener<[string]>[] = [];
  private closeListeners: Listener<[]>[] = [];

  public readonly remoteAddress?: string;

  constructor(socket: RawSocket, initialTail: Buffer) {
    this.socket = socket;
    this.remoteAddress = socket.remoteAddress;
    this.recvBuffer = initialTail;

    socket.on('data', (chunk) => this.handleData(chunk as Buffer));
    socket.on('close', () => this.handleClose());
    socket.on('error', () => this.handleClose());

    // Process any WS frame bytes that arrived attached to the handshake request itself.
    if (this.recvBuffer.length > 0) this.drainFrames();
  }

  onMessage(cb: Listener<[string]>): void {
    this.messageListeners.push(cb);
  }

  onClose(cb: Listener<[]>): void {
    this.closeListeners.push(cb);
  }

  send(text: string): void {
    if (this.closed) return;
    try {
      this.socket.write(encodeTextFrame(text));
    } catch {
      // Socket already gone; the close handler will fire separately.
    }
  }

  close(code = 1000, reason = ''): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket.write(encodeCloseFrame(code, reason));
      this.socket.end();
    } catch {
      // ignore
    }
    this.emitClose();
  }

  private handleData(chunk: Buffer): void {
    if (this.closed) return;
    this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);
    this.drainFrames();
  }

  private drainFrames(): void {
    for (;;) {
      const frame: DecodedFrame | null = tryDecodeFrame(this.recvBuffer);
      if (!frame) return;
      this.recvBuffer = Buffer.from(this.recvBuffer.subarray(frame.byteLength));
      this.handleFrame(frame);
      if (this.closed) return;
    }
  }

  private handleFrame(frame: DecodedFrame): void {
    switch (frame.opcode) {
      case OPCODE.TEXT:
      case OPCODE.BINARY:
        if (frame.fin) {
          this.emitMessage(frame.payload);
        } else {
          this.fragmentOpcode = frame.opcode;
          this.fragmentChunks = [frame.payload];
        }
        break;
      case OPCODE.CONTINUATION:
        if (this.fragmentOpcode !== null) {
          this.fragmentChunks.push(frame.payload);
          if (frame.fin) {
            const full = Buffer.concat(this.fragmentChunks);
            this.fragmentOpcode = null;
            this.fragmentChunks = [];
            this.emitMessage(full);
          }
        }
        break;
      case OPCODE.PING:
        try {
          this.socket.write(encodePongFrame(frame.payload));
        } catch {
          // ignore
        }
        break;
      case OPCODE.PONG:
        break;
      case OPCODE.CLOSE:
        this.close();
        break;
      default:
        break;
    }
  }

  private emitMessage(payload: Buffer): void {
    const text = payload.toString('utf8');
    for (const cb of this.messageListeners) cb(text);
  }

  private handleClose(): void {
    if (this.closed) return;
    this.closed = true;
    this.emitClose();
  }

  private emitClose(): void {
    for (const cb of this.closeListeners) cb();
  }
}

export interface WSServerOptions {
  /** Called once an HTTP Upgrade handshake has completed and the socket is a live WS connection. */
  onConnection: (conn: WSConnection) => void;
}

/**
 * Wraps a `RawServer` (TCP-level) and speaks just enough HTTP/1.1 to perform the RFC 6455
 * Upgrade handshake, then hands off to `WSConnection` for framed messaging. No HTTP routing,
 * cookies, or extensions -- this only ever serves a single WebSocket endpoint.
 */
export function attachWebSocketServer(server: RawServer, options: WSServerOptions): void {
  const onConnection: ConnectionListener = (socket) => {
    let buffer = Buffer.alloc(0);
    let handshakeDone = false;

    const onData = (chunk?: Buffer | Error) => {
      if (handshakeDone || !chunk || !(chunk instanceof Buffer)) return; // WSConnection takes over after this point
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const headerText = Buffer.from(buffer.subarray(0, headerEnd)).toString('utf8');
      const tail = Buffer.from(buffer.subarray(headerEnd + 4));
      const key = extractHeader(headerText, 'Sec-WebSocket-Key');

      if (!key) {
        try {
          socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        } catch {
          // ignore
        }
        socket.destroy();
        return;
      }

      const acceptKey = computeAcceptKey(key);
      const response =
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`;

      try {
        socket.write(response);
      } catch {
        socket.destroy();
        return;
      }

      handshakeDone = true;
      const conn = new WSConnection(socket, tail);
      options.onConnection(conn);
    };

    socket.on('data', onData as any);
  };
  server.on('connection', onConnection);
}

function extractHeader(headerText: string, name: string): string | null {
  const lines = headerText.split('\r\n');
  const prefix = `${name.toLowerCase()}:`;
  for (const line of lines) {
    if (line.toLowerCase().startsWith(prefix)) {
      return line.slice(line.indexOf(':') + 1).trim();
    }
  }
  return null;
}
