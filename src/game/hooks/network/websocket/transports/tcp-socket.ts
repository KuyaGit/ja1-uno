import { Buffer } from 'buffer';
import TcpSocket from 'react-native-tcp-socket';
import { RawServer, RawSocket } from '../raw-socket';
import { ServerTransport } from './types';

type TcpServer = ReturnType<typeof TcpSocket.createServer>;

/**
 * `react-native-tcp-socket`-backed server transport. This is the one that actually runs on the
 * host's phone: `react-native-tcp-socket` opens a real TCP listen socket via its native module,
 * and `attachWebSocketServer` (ws-server.ts) speaks WebSocket framing on top of it.
 */
export class TcpSocketServerTransport implements ServerTransport {
  private server: TcpServer;

  constructor() {
    this.server = TcpSocket.createServer(() => {});
  }

  listen(port: number, host = '0.0.0.0'): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => reject(err);
      this.server.once?.('error', onError);
      this.server.listen({ port, host }, () => {
        this.server.removeListener?.('error', onError);
        resolve();
      });
    });
  }

  getRawServer(): RawServer {
    const server = this.server;
    return {
      listen: () => {},
      on: (event, cb) => {
        if (event === 'connection') {
          const onConnection = cb as (socket: RawSocket) => void;
          server.on('connection', (socket: any) => onConnection(wrapTcpSocket(socket)));
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
    return addr ? { port: addr.port } : null;
  }
}

function wrapTcpSocket(socket: any): RawSocket {
  return {
    write: (data) => {
      socket.write(Buffer.isBuffer(data) ? data : Buffer.from(data as any));
    },
    end: (data) => {
      if (data) socket.end(Buffer.isBuffer(data) ? data : Buffer.from(data as any));
      else socket.end();
    },
    destroy: () => socket.destroy(),
    on: (event, cb) => {
      socket.on(event, (chunk: any) => {
        if (event === 'data') {
          (cb as (arg?: Buffer) => void)(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        } else {
          (cb as (arg?: any) => void)(chunk);
        }
      });
    },
    get remoteAddress() {
      return socket.remoteAddress;
    },
  };
}
