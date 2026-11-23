import { Buffer } from 'buffer';

export type RawSocketEvent = 'data' | 'close' | 'error';
export type RawSocketCallback = (arg?: Buffer | Error) => void;

/**
 * The minimal socket surface `ws-server.ts` needs. Both `net.Socket` (Node) and
 * react-native-tcp-socket's `Socket` satisfy this shape closely enough that thin adapters in
 * `transports/` can implement it directly.
 */
export interface RawSocket {
  write(data: Buffer | Uint8Array | string): void;
  end(data?: Buffer | Uint8Array | string): void;
  destroy(): void;
  on(event: RawSocketEvent, cb: RawSocketCallback): void;
  remoteAddress?: string;
}

export type RawServerCallback = ((socket: RawSocket) => void) | RawSocketCallback;

export interface RawServer {
  listen(port: number, host: string, cb?: () => void): void;
  on(event: 'connection' | 'error', cb: RawServerCallback): void;
  close(cb?: () => void): void;
}
