export interface ClientTransportHandlers {
  onOpen(): void;
  onMessage(raw: string): void;
  onClose(code: number, reason: string): void;
  onError(err: Error): void;
}

/** What `GameClient` needs from a transport: connect, send text frames, close. */
export interface ClientTransport {
  connect(handlers: ClientTransportHandlers): void;
  send(text: string): void;
  close(): void;
}

/**
 * Real network transport: the RN built-in `WebSocket` talking to `ws://host:port`. This is what
 * every remote player (anyone who isn't the host's own device) uses.
 */
export class WebSocketClientTransport implements ClientTransport {
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(handlers: ClientTransportHandlers): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => handlers.onOpen();
    ws.onmessage = (evt) => handlers.onMessage(String(evt.data));
    ws.onclose = (evt) => handlers.onClose(evt.code, evt.reason);
    ws.onerror = () => handlers.onError(new Error('WebSocket error'));
  }

  send(text: string): void {
    this.ws?.send(text);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
