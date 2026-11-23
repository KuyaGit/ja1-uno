import { RawServer } from '../raw-socket';

/** Abstraction over "something that can accept raw TCP connections and hand them to ws-server." */
export interface ServerTransport {
  /** Starts listening. Resolves once bound. */
  listen(port: number, host?: string): Promise<void>;
  /** The underlying RawServer-compatible object, for `attachWebSocketServer`. */
  getRawServer(): RawServer;
  close(): Promise<void>;
}
