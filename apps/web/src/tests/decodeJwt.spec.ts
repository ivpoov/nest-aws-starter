import { describe, expect, it } from 'vitest';
import { decodeJwtPayload } from '../utils/decodeJwt';

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeJwt(payload: Record<string, unknown>): string {
  return `header.${base64UrlEncode(JSON.stringify(payload))}.signature`;
}

describe('decodeJwtPayload', () => {
  it('decodes a well-formed payload', () => {
    const token: string = fakeJwt({ sessionId: 's-1', role: 'USER', actAsBy: 'admin-1' });

    expect(decodeJwtPayload<{ sessionId: string; actAsBy: string }>(token)).toEqual({
      sessionId: 's-1',
      role: 'USER',
      actAsBy: 'admin-1',
    });
  });

  it('returns null for a token missing segments', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('only.two')).toBeNull();
  });

  it('returns null for a payload segment that is not valid base64/JSON', () => {
    expect(decodeJwtPayload('header.not-base64-!!!.signature')).toBeNull();
  });

  it('round-trips base64url characters not present in plain base64', () => {
    const token: string = fakeJwt({ note: '???>>>' });

    expect(decodeJwtPayload<{ note: string }>(token)?.note).toBe('???>>>');
  });
});
