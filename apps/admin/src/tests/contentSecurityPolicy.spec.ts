import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
});
