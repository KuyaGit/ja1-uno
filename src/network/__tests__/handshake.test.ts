import { computeAcceptKey } from '../websocket/sha1';

describe('WebSocket handshake accept key (RFC 6455 section 1.3 test vector)', () => {
  it('matches the RFC example: dGhlIHNhbXBsZSBub25jZQ== -> s3pPLMBiTxaQ9kYGzzhZRbK+xOo=', () => {
    expect(computeAcceptKey('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });
});
