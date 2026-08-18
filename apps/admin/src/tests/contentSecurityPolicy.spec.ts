import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPolicy } from '../../vite.config';

// index.html is read from disk on purpose: the policy authorises the inline
// theme bootstrap by hash, and the hash is only correct while the regex in
// vite.config.ts still recognises that script. Give the tag an attribute, add
// a second inline script, and this catches it — the build would otherwise ship
// a policy that blocks the very script it was written around.
const APP_ROOT: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html: string = readFileSync(path.join(APP_ROOT, 'index.html'), 'utf8');

describe('content security policy', () => {
  it('authorises the inline theme bootstrap by its actual hash', () => {
    const inline: string = (
      html.match(/<script>([\s\S]*?)<\/script>/) as RegExpMatchArray
    )[1] as string;
    const expected: string = createHash('sha256').update(inline).digest('base64');

    expect(inline).toContain('dataset.theme');
    expect(buildPolicy(html)).toContain(`'sha256-${expected}'`);
  });

  it('keeps the directives that make the policy worth shipping', () => {
    const policy: string = buildPolicy(html);

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-src 'none'");
    // No 'unsafe-inline' and no 'unsafe-eval' anywhere in script-src: the
    // whole point of hashing the bootstrap is to avoid needing either.
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain('unsafe-eval');
  });

  it('lets the app reach its own API over http and over the socket upgrade', () => {
    const policy: string = buildPolicy(html);

    expect(policy).toContain('http://localhost:3000');
    expect(policy).toContain('ws://localhost:3000');
  });

  // The `https:` fallback is the policy's weakest point — it authorises every
  // TLS origin there is. It exists only because presigned media origins are
  // not known at build time, so a deployment that DOES know them must be able
  // to spend that knowledge on a narrower policy.
  describe('media origins', () => {
    const ORIGINAL: string | undefined = process.env.VITE_MEDIA_ORIGINS;

    afterEach(() => {
      if (ORIGINAL === undefined) delete process.env.VITE_MEDIA_ORIGINS;
      else process.env.VITE_MEDIA_ORIGINS = ORIGINAL;
    });

    it('falls back to the https: wildcard when no origins are configured', () => {
      delete process.env.VITE_MEDIA_ORIGINS;

      const policy: string = buildPolicy(html);

      expect(policy).toContain("img-src 'self' data: blob: https:");
    });

    it('drops the wildcard from both directives once origins are configured', () => {
      process.env.VITE_MEDIA_ORIGINS = 'https://cdn.example.com, https://bucket.example.com';

      const policy: string = buildPolicy(html);
      const imgSrc: string = policy.split('; ').find((d: string) => d.startsWith('img-src')) ?? '';
      const connectSrc: string =
        policy.split('; ').find((d: string) => d.startsWith('connect-src')) ?? '';

      expect(imgSrc).toContain('https://cdn.example.com');
      expect(imgSrc).toContain('https://bucket.example.com');
      expect(imgSrc.split(' ')).not.toContain('https:');
      expect(connectSrc).toContain('https://cdn.example.com');
      expect(connectSrc.split(' ')).not.toContain('https:');
    });
  });
});
