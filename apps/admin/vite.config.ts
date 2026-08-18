import { createHash } from 'node:crypto';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Why the policy is injected at build time instead of living in index.html:
//
// - A `<meta http-equiv>` in the source HTML also applies to `pnpm dev`, and
//   the dev server needs everything a shippable policy forbids — the React
//   Refresh preamble is an inline module script, dev CSS arrives as
//   JS-injected `<style>` elements, and HMR opens a WebSocket to the dev
//   origin. A policy loose enough for dev is not worth shipping.
// - The hash for the inline theme bootstrap is computed from the HTML being
//   emitted, so it cannot drift from the script it authorises. That script is
//   load-bearing (it sets `data-theme` before first paint; see
//   docs/conventions/frontend.md) and it is coupled to the theme store's
//   persist shape, so a hand-maintained hash would rot on the next change to
//   either.
// - `connect-src` needs the API origin, which is a build input
//   (`VITE_API_BASE_URL`) and not a constant.
//
// Why `<meta>` and not a CloudFront response-headers policy: the policy has to
// travel with the artifact. The bundle is also served by `vite preview`, by a
// container, and by whatever host a fork picks — an edge-only policy protects
// exactly one of those. `frame-ancestors` is the one directive a `<meta>` tag
// cannot carry; clickjacking cover therefore still comes from the edge
// (`X-Frame-Options` on the CloudFront response-headers policy), and moving
// `frame-ancestors 'none'` there is the follow-up this change does not make.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'inject-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html: string): string {
        const meta: string = `<meta http-equiv="Content-Security-Policy" content="${buildPolicy(html)}" />`;

        return html.replace('<head>', `<head>\n    ${meta}`);
      },
    },
  };
}

export function buildPolicy(html: string): string {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    // Nothing here submits a real HTML form — every submit is a JS handler —
    // and the OAuth hand-off is an <a href> navigation, which no fetch
    // directive governs. 'self' is therefore free.
    "form-action 'self'",
    // The load-bearing directive: no inline script runs except the ones this
    // build actually emitted, and no script is fetched off-origin.
    `script-src 'self' ${inlineScriptHashes(html).join(' ')}`.trim(),
    // Recharts writes inline `style` attributes on the admin dashboard's SVG
    // nodes at runtime, and style-src-attr falls back to style-src. Kept
    // identical in both apps by the sibling rule in frontend.md rather than
    // granting it to one of them only.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // Avatars and file downloads are presigned S3/CloudFront URLs minted by the
    // API at request time, so their origin is not a build input by default and
    // the policy falls back to `https:` — any TLS origin, which is most of what
    // CSP was protecting against. Set VITE_MEDIA_ORIGINS to your bucket or
    // distribution (space- or comma-separated) and that wildcard disappears
    // from both this directive and connect-src. A production build previewed
    // locally against MinIO puts that http origin in the same variable.
    `img-src 'self' data: blob: ${mediaSources().join(' ')}`,
    // The API origin is listed explicitly because a local preview talks to it
    // over http, which the `https:` fallback does not cover; `wss:` is the
    // Socket.IO upgrade, which browsers do not consider covered by an https
    // source.
    `connect-src 'self' ${apiOrigins().join(' ')} ${mediaSources().join(' ')} wss:`,
  ].join('; ');
}

// Every inline <script> in the emitted HTML, hashed exactly as the browser
// hashes it: the raw text between the tags, no trimming.
function inlineScriptHashes(html: string): string[] {
  const inlineScripts: string[] = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (match: RegExpMatchArray): string => match[1] as string,
  );

  return inlineScripts.map(
    (body: string): string => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
  );
}

// The origins that serve presigned media. Unset means "unknown at build time",
// and the only policy that still works is the `https:` wildcard the audit
// called the highest-value tightening left here — so setting this variable is
// how a deployment buys that back. Accepts space- or comma-separated origins.
function mediaSources(): string[] {
  const configured: string = process.env.VITE_MEDIA_ORIGINS ?? '';
  const origins: string[] = configured
    .split(/[\s,]+/)
    .map((value: string): string => value.trim())
    .filter((value: string): boolean => value.length > 0);

  return origins.length > 0 ? origins : ['https:'];
}

// Both the http(s) and the ws(s) form of whatever VITE_API_BASE_URL points at
// — apiClient fetches the former, the notification socket upgrades to the
// latter. Falls back to the same default the app itself uses.
function apiOrigins(): string[] {
  const baseUrl: string = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

  try {
    const origin: string = new URL(baseUrl).origin;

    return [origin, origin.replace(/^http/, 'ws')];
  } catch {
    return [];
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  server: { port: 5174 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    setupFiles: ['src/tests/setup.ts'],
  },
});
