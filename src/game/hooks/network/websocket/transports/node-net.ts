import net from 'net';
import { RawServer, RawSocket } from '../raw-socket';
import { ServerTransport } from './types';

/**
 * Node `net`-backed server transport. Used for unit/integration tests (run under Jest's Node
 * environment) and for local dev/CLI tooling -- never shipped inside the mobile app bundle.
 */
export class NodeNetServerTransport implements ServerTransport {
  private server: net.Server;

  constructor() {
    this.server = net.createServer();
  }

  listen(port: number, host = '0.0.0.0'): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => reject(err);
      this.server.once('error', onError);
      this.server.listen(port, host, () => {
        this.server.removeListener('error', onError);
        resolve();
      });
    });
  }

  getRawServer(): RawServer {
    const server = this.server;
    return {
      listen: () => {
        // Already listening via `this.listen`; no-op to satisfy the interface.
      },
      on: (event, cb) => {
        if (event === 'connection') {
          const onConnection = cb as (socket: RawSocket) => void;
          server.on('connection', (socket: net.Socket) => onConnection(wrapNodeSocket(socket)));
        } else if (event === 'error') {
          server.on('error', cb as (err: Error) => void);
        }
      },
      close: (cb) => server.close(cb),
    };
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  address(): { port: number } | null {
    const addr = this.server.address();
    if (addr && typeof addr === 'object') return { port: addr.port };
    return null;
  }
}

function wrapNodeSocket(socket: net.Socket): RawSocket {
  return {
    write: (data) => {
      socket.write(data as any);
    },
    end: (data) => {
      if (data) socket.end(data as any);
      else socket.end();
    },
    destroy: () => socket.destroy(),
    on: (event, cb) => {
      socket.on(event, cb as any);
    },
    get remoteAddress() {
      return socket.remoteAddress;
    },
  };
}
