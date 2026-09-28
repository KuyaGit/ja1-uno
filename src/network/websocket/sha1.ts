import { Buffer } from 'buffer';

/**
 * Minimal, dependency-free synchronous SHA-1 implementation.
 *
 * The RFC 6455 WebSocket handshake requires computing
 * base64(SHA1(secWebSocketKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")) synchronously, inline
 * in the HTTP Upgrade response. `expo-crypto`'s digestStringAsync is async-only, which doesn't
 * fit a synchronous handshake response, so we ship a small pure-JS SHA-1 here instead. This is
 * only used for the (non-security-critical) WS handshake accept key, never for anything sensitive.
 */

function rotl(n: number, b: number): number {
  return (n << b) | (n >>> (32 - b));
}

/** Returns the raw 20-byte SHA-1 digest of `message` (interpreted as UTF-8) as a Buffer. */
export function sha1(message: string | Uint8Array): Buffer {
  const bytes = typeof message === 'string' ? Buffer.from(message, 'utf8') : Buffer.from(message);

  const ml = bytes.length * 8;
  const withOne = Buffer.concat([bytes, Buffer.from([0x80])]);
  const paddingLength = (56 - (withOne.length % 64) + 64) % 64;
  const padded = Buffer.concat([withOne, Buffer.alloc(paddingLength), Buffer.alloc(8)]);
  padded.writeUInt32BE(Math.floor(ml / 0x100000000), padded.length - 8);
  padded.writeUInt32BE(ml >>> 0, padded.length - 4);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Array<number>(80);

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = padded.readUInt32BE(chunkStart + i * 4);
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = Buffer.alloc(20);
  out.writeUInt32BE(h0, 0);
  out.writeUInt32BE(h1, 4);
  out.writeUInt32BE(h2, 8);
  out.writeUInt32BE(h3, 12);
  out.writeUInt32BE(h4, 16);
  return out;
}

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** Computes the Sec-WebSocket-Accept header value for a given client Sec-WebSocket-Key. */
export function computeAcceptKey(secWebSocketKey: string): string {
  return sha1(secWebSocketKey.trim() + WS_GUID).toString('base64');
}
