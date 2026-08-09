# 4. Bearer tokens in the Authorization header, no cookies

Status: accepted — **with a known trade-off, stated in full below**

## Context

The API is consumed by two separate single-page applications (`apps/web`, `apps/admin`)
served from different origins, and is meant to be consumed by mobile and server-to-server
clients too. There are two mainstream ways to carry a session:

1. **Cookies** — `HttpOnly; Secure; SameSite`. The browser attaches them automatically. They
   are unreadable from JavaScript, which defeats token theft by XSS, but they are *ambient*:
   the browser attaches them to any request to that origin, including one triggered by an
   attacker's page. That is CSRF, and it has to be defended separately.
2. **Bearer tokens** — the client stores the token and sets `Authorization: Bearer …`
   explicitly. Nothing is ambient, so CSRF is structurally impossible. But the token must
   live somewhere JavaScript can read, which is exactly what XSS gets to read too.

There is no option that avoids both problems. Choosing one means choosing which failure
mode to own.

## Decision

Bearer tokens. The API sets no cookie and reads no cookie, anywhere.

- `JwtAuthGuard` reads `Authorization: Bearer …` and nothing else.
- CORS is an exact-match origin allowlist with `credentials: false`, permanently. The
  comment in `configure-app.helper.ts` explains why it must stay off: with no ambient
  credential to attach, `Access-Control-Allow-Credentials: true` buys nothing while
  permanently coupling the allowlist to a CSRF exposure. If a browser request ever fails
  with a CORS error, the fix is the allowlist or the header list — never that flag.
- The refresh token travels in a request **body**, not a cookie.
- The WebSocket handshake carries the access token in the Socket.IO `auth.token` payload —
  same contract, same reason (`NotificationGateway`).
- OAuth `state` is **not** a browser cookie: it is a server-side Redis key consumed with
  `GETDEL` (`oauth:state:{state}`, 600s TTL), so the OAuth CSRF defence does not reintroduce
  a cookie through the back door.
- There is no CSRF token and no double-submit cookie anywhere in the tree, and that is
  correct: with no ambient credential there is nothing for CSRF to forge.

The claim is verifiable: `grep -ri 'set-cookie\|@fastify/cookie\|credentials: .include.'` over
`apps/api`, `apps/web` and `apps/admin` returns prose only — no code.

## Consequences

**Good**

- **CSRF is structurally impossible**, not mitigated. No `SameSite` reasoning, no
  anti-forgery token, no per-form nonce, no exemption list for webhooks. One entire class of
  bug cannot occur.
- Non-browser clients are first-class. A CLI, a mobile app, a server-side integration and a
  test suite all authenticate identically; there is no cookie jar to emulate.
- Cross-origin deployment is trivial. `web`, `admin` and the API can sit on unrelated
  domains with no cookie-domain gymnastics and no third-party-cookie exposure as browsers
  keep tightening.
- Logout and revocation are server-side facts, not client-side hygiene: the Redis allowlist
  ([ADR 3](./0003-tokens-in-redis-never-postgres.md)) invalidates a stolen token the moment
  the session is revoked, without waiting for a cookie to expire.

**Bad — this is the trade-off, stated honestly**

- **An XSS in either SPA hands the attacker the session.** Both `apps/web` and `apps/admin`
  persist the auth state with `zustand/middleware`'s `persist`, which defaults to
  `localStorage` under the key `auth` (`apps/web/src/stores/auth.store.ts`,
  `apps/admin/src/stores/auth.store.ts`; asserted by
  `apps/web/src/tests/auth.store.spec.ts`). One line of injected script reads it. With
  `HttpOnly` cookies the same XSS could *act* as the user while the page is open, but could
  not *take* the credential; here it can.
- **The refresh token is the real loss, not the access token.** The access token is short
  (15 minutes by default). The refresh token in the same `localStorage` object lasts 30 days
  by default and renews silently. Exfiltrating it converts a momentary script injection into
  a month of persistent access from anywhere.
- **Refresh-token rotation reduces the window but does not close it.** Sessions rotate the
  refresh token and keep a short grace copy; reusing an already-rotated token trips
  `AUTH_REFRESH_REUSED` and kills the session. That catches an attacker who refreshes
  *before* the legitimate client does. An attacker who refreshes *after* the victim's tab
  goes idle is not detected by it.
- **The admin SPA raises the stakes.** An admin session can call `login-as`, so an XSS in
  `apps/admin` reaches impersonation. Both SPAs are behind the same storage choice; the blast
  radius is not the same.
- **The API's CSP does not protect the SPAs.** `@fastify/helmet` sends
  `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` on API
  responses, which hardens the API against ever returning a scriptable document. It does
  nothing for `web`/`admin`, which are separate static deployments. Neither `apps/web/index.html`
  nor `apps/admin/index.html` ships a CSP, and both contain an inline theme-bootstrap
  `<script>`, so adding one later needs a hash or nonce rather than a copy-paste policy.
  **The single highest-value hardening left on this decision is a CSP on the SPA origins.**

**If you need cookies instead**

This is a starter; reversing the decision is legitimate for a browser-only product with a
high XSS-blast-radius. Reversing it properly means all of: a cookie-setting login/refresh
path, `credentials: true` plus a tightened allowlist, `SameSite` chosen deliberately, an
anti-forgery token for state-changing requests, and a separate scheme for non-browser
clients. Flipping `credentials: true` on its own is the worst of both worlds — do not.
