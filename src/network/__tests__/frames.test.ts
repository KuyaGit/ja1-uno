import { Buffer } from 'buffer';
import { encodeMaskedFrame, encodeTextFrame, OPCODE, tryDecodeFrame } from '../websocket/frames';

describe('frame encode/decode', () => {
  it('round-trips an unmasked (server) text frame', () => {
    const encoded = encodeTextFrame('hello world');
    const decoded = tryDecodeFrame(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.fin).toBe(true);
    expect(decoded!.opcode).toBe(OPCODE.TEXT);
    expect(decoded!.payload.toString('utf8')).toBe('hello world');
    expect(decoded!.byteLength).toBe(encoded.length);
  });

  it('round-trips a masked (client) text frame and unmasks correctly', () => {
    const payload = Buffer.from(JSON.stringify({ type: 'HELLO', v: 1, roomCode: 'ABCD', name: 'x', avatar: 'y' }));
    const encoded = encodeMaskedFrame(OPCODE.TEXT, payload);
    const decoded = tryDecodeFrame(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.payload.equals(payload)).toBe(true);
  });

  it('handles payloads requiring the 16-bit extended length field', () => {
    const payload = Buffer.alloc(1000, 'a');
    const encoded = encodeMaskedFrame(OPCODE.TEXT, payload);
    const decoded = tryDecodeFrame(encoded);
    expect(decoded!.payload.length).toBe(1000);
  });

  it('returns null when the buffer contains an incomplete frame (partial header)', () => {
    const encoded = encodeTextFrame('some message');
    const partial = encoded.subarray(0, 1);
    expect(tryDecodeFrame(Buffer.from(partial))).toBeNull();
  });

  it('returns null when the payload has not fully arrived yet (fragmented TCP read)', () => {
    const encoded = encodeMaskedFrame(OPCODE.TEXT, Buffer.from('a longer message body here'));
    const partial = encoded.subarray(0, encoded.length - 3);
    expect(tryDecodeFrame(Buffer.from(partial))).toBeNull();
  });

  it('decodes correctly once the rest of a fragmented TCP read arrives', () => {
    const message = 'reassembled across multiple TCP packets';
    const encoded = encodeMaskedFrame(OPCODE.TEXT, Buffer.from(message));
    const firstHalf = Buffer.from(encoded.subarray(0, 3));
    const secondHalf = Buffer.from(encoded.subarray(3));

    expect(tryDecodeFrame(firstHalf)).toBeNull();
    const full = Buffer.concat([firstHalf, secondHalf]);
    const decoded = tryDecodeFrame(full);
    expect(decoded).not.toBeNull();
    expect(decoded!.payload.toString('utf8')).toBe(message);
  });

  it('reports the exact byte length consumed so extra trailing bytes are preserved', () => {
    const encoded = encodeTextFrame('first');
    const next = encodeTextFrame('second');
    const combined = Buffer.concat([encoded, next]);
    const first = tryDecodeFrame(combined);
    expect(first!.payload.toString('utf8')).toBe('first');
    const rest = Buffer.from(combined.subarray(first!.byteLength));
    const second = tryDecodeFrame(rest);
    expect(second!.payload.toString('utf8')).toBe('second');
  });
});
