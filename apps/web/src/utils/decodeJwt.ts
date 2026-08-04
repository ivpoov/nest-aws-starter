import { logger } from './logger';

// Decodes a JWT payload for display only — no signature verification. Never
// use the result for anything security-relevant; the API is the source of
// truth for what a token grants.
export function decodeJwtPayload<T>(token: string): T | null {
  const segments: string[] = token.split('.');

  if (segments.length !== 3 || !segments[1]) return null;

  try {
    const base64: string = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padLength: number = (4 - (base64.length % 4)) % 4;
    const padded: string = base64 + '='.repeat(padLength);

    return JSON.parse(atob(padded)) as T;
  } catch (caught) {
    logger.debug('decodeJwtPayload: malformed token', caught);

    return null;
  }
}
