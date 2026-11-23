import { Buffer } from 'buffer';

export const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
} as const;

export interface DecodedFrame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
  /** Total bytes consumed from the input buffer for this frame. */
  byteLength: number;
}

/**
 * Attempts to decode a single WebSocket frame from the front of `buf`.
 * Returns `null` if `buf` does not yet contain a complete frame (caller should wait for more data
 * -- this is what makes the parser resilient to TCP fragmentation, where a single frame can
 * arrive split across several `data` events).
 */
export function tryDecodeFrame(buf: Buffer): DecodedFrame | null {
  if (buf.length < 2) return null;

  const b0 = buf[0];
  const b1 = buf[1];
  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let payloadLen = b1 & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < offset + 2) return null;
    payloadLen = buf.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLen === 127) {
    if (buf.length < offset + 8) return null;
    const high = buf.readUInt32BE(offset);
    const low = buf.readUInt32BE(offset + 4);
    payloadLen = high * 2 ** 32 + low;
    offset += 8;
  }

  let maskKey: Buffer | null = null;
  if (masked) {
    if (buf.length < offset + 4) return null;
    maskKey = Buffer.from(buf.subarray(offset, offset + 4));
    offset += 4;
  }

  if (buf.length < offset + payloadLen) return null;

  let payload: Buffer = Buffer.from(buf.subarray(offset, offset + payloadLen));
  if (masked && maskKey) {
    const unmasked = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      unmasked[i] = payload[i] ^ maskKey[i % 4];
    }
    payload = unmasked;
  } else {
    payload = Buffer.from(payload);
  }

  return { fin, opcode, payload, byteLength: offset + payloadLen };
}

/** Encodes a single, unmasked frame -- what the server sends to clients (servers never mask). */
export function encodeFrame(opcode: number, payload: Buffer, fin = true): Buffer {
  const len = payload.length;
  let header: Buffer;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeUInt32BE(Math.floor(len / 2 ** 32), 2);
    header.writeUInt32BE(len >>> 0, 6);
  }
  header[0] = (fin ? 0x80 : 0) | (opcode & 0x0f);

  return Buffer.concat([header, payload]);
}

export function encodeTextFrame(text: string): Buffer {
  return encodeFrame(OPCODE.TEXT, Buffer.from(text, 'utf8'));
}

export function encodeCloseFrame(code = 1000, reason = ''): Buffer {
  const reasonBuf = Buffer.from(reason, 'utf8');
  const payload = Buffer.alloc(2 + reasonBuf.length);
  payload.writeUInt16BE(code, 0);
  reasonBuf.copy(payload, 2);
  return encodeFrame(OPCODE.CLOSE, payload);
}

export function encodePongFrame(payload: Buffer = Buffer.alloc(0)): Buffer {
  return encodeFrame(OPCODE.PONG, payload);
}

export function encodePingFrame(payload: Buffer = Buffer.alloc(0)): Buffer {
  return encodeFrame(OPCODE.PING, payload);
}

/**
 * Masks a client->server frame -- used only by test clients / a future native RN client
 * implementation that doesn't already provide one (the RN built-in WebSocket masks for us).
 */
export function encodeMaskedFrame(opcode: number, payload: Buffer, fin = true): Buffer {
  const maskKey = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) maskKey[i] = Math.floor(Math.random() * 256);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ maskKey[i % 4];

  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeUInt32BE(Math.floor(len / 2 ** 32), 2);
    header.writeUInt32BE(len >>> 0, 6);
  }
  header[0] = (fin ? 0x80 : 0) | (opcode & 0x0f);

  return Buffer.concat([header, maskKey, masked]);
}
