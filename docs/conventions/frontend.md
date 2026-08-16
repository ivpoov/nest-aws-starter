# Frontend Conventions

React 19 — TypeScript — Vite — Tailwind 4 — Zustand — Socket.IO — Vitest + Testing Library

These rules are binding for `apps/web` (the user-facing app) and `apps/admin` (the
back office). The two apps are deliberately **siblings, not a shared library**: they
have the same shape, the same layers and near-identical infrastructure files, but no
`packages/ui`. The only thing they share is `packages/shared` — the wire contracts
(see [`shared-contracts.md`](./shared-contracts.md)).

That duplication is a choice, not an oversight. A starter is meant to be forked and
cut down; two independent apps can diverge or be deleted without unpicking a common
package. Where a file *is* duplicated (`utils/apiClient.ts`, `utils/logger.ts`,
`stores/auth.store.ts`, `styles/global.css`), keep the two copies literally in sync
unless there is a stated reason — the copies today differ in exactly two places, both
deliberate:

- `apps/web/src/utils/apiClient.ts` has a `put` method; the admin copy does not,
  because nothing in the admin app issues a `PUT`.
- `apps/admin/src/styles/global.css` adds an `--overlay` token for the modal scrim;
  the web app has no modal.

Everything below is verifiable in the code. If you find a rule here the code does not
follow, that is a bug — in one of the two.

---

## 1. Layers

```
pages/  →  components/  →  ui/
   │            │
   └──→  hooks/  ──→  apis/  ──→  utils/apiClient  ──→  HTTP
             │
             └──→  stores/        contexts/  (cross-tree wiring)
```

| Folder | Owns | Never contains |
|---|---|---|
| `pages/` | One route = one file. Composition, page-level layout, route params | Fetch logic, `apiClient`, business rules |
| `components/<Feature>/` | Feature-specific presentational components, driven entirely by props | `apis/`, `apiClient`, data fetching |
| `components/ui/` | App-agnostic primitives (`Button`, `Card`, `Input`, `Badge`, `EmptyState`, …) | Anything feature-aware |
| `hooks/<feature>/` | All stateful behaviour: fetch + loading + error + pagination + mutation | JSX, raw `fetch` |
| `apis/<feature>/` | One thin function per endpoint; query-string assembly | React, state, error mapping beyond the envelope |
| `stores/` | Cross-tree client state that outlives a route (auth tokens, theme) | Server data caches |
| `contexts/` | One provider per shared live resource (today: the notification socket) | Business logic |
| `interfaces/` `types/` | One declaration per file (§3) | Anything executable |
| `constants/` | Named literals grouped by topic, with a comment saying *why* the value is what it is | Logic |
| `utils/` | Pure functions and the one HTTP client | React hooks |

**The rules that make this checkable:**

- **`apiClient` is imported only by `apis/*.api.ts`.** Grep it: every import site is
  an api module. The single exception is `apps/web/src/hooks/files/useFileUpload.ts`,
  which calls `apiClient.uploadToUrl` — a presigned-S3 `PUT` that is not an API
  endpoint at all, and the client's one non-API method by design.
- **Components never import `apis/`.** Not one component in either app does. Data
  arrives as props from a page, or from a hook the page called.
- **Pages call a hook, or — for a one-shot form submit with no reusable state — an
  `apis/` function directly.** `LoginPage`, `RegisterPage`, `ForgotPasswordPage`,
  `ResetPasswordPage`, `VerifyEmailPage`, `OauthCallbackPage` and `ContactPage` take
  the direct route: a submit handler, a local `isSubmitting`/`error` pair, done.
  The moment a page needs a list, a cursor, a refetch or an optimistic update, that
  belongs in a hook — no page in either app fetches a list itself.
- **Every hook returns one named result interface.** `useNotificationList(): UseNotificationListResultInterface`,
  `useAdminUsers(): UseAdminUsersResultInterface`. The interface lives in
  `interfaces/use-<name>-result.interface.ts`, one per hook. An inline return type on
  a hook is a review comment.

### Filter hooks

Multi-field filter state gets its own hook, separate from the list hook that consumes
it: `useTransactionFilters`, `useActivityFilters`, `useNotificationHistoryFilters` in
the admin app. The filter hook owns a single `…FiltersInterface` object plus the
setters that normalise input, and it does no I/O at all. The pattern matters because
the normalisation is where the bugs live —
`apps/admin/src/hooks/transactions/useTransactionFilters.ts` turns a date input's
`YYYY-MM-DD` into `${value}T00:00:00.000Z` / `${value}T23:59:59.000Z` so the value it
hands the API is already the ISO string the contract requires (see
[`shared-contracts.md` §4](./shared-contracts.md)). The list hook takes the filters
object and does nothing but request with it.

## 2. Module removal fences

Optional features are fenced so `scripts/subtraction-test.mjs` can delete them. On
the frontend the fences live in `App.tsx` — a `// <module:x>` trailing comment on the
import line, and a `{/* <module:x> */}` … `{/* </module:x> */}` pair around the
routes. See `apps/web/src/App.tsx`.

This has one design consequence worth stating: a provider that must wrap
authenticated routes is written as a **pathless layout route** rendering `<Outlet />`
(`NotificationSocketProvider`), not as a `children` wrapper. A `<Route element={…}>`
line can be fenced out; unwrapping hand-nested JSX cannot. If you add a provider
around routes, follow that shape.

## 3. TypeScript

The frontend inherits the backend's type discipline
([`backend.md` §2](./backend.md)). The compiler settings that back it, identical in
both `tsconfig.json` files: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`.

- **Objects are `interface`s**, in `interfaces/`, suffixed `.interface.ts`, every
  property `readonly` — including function-valued ones
  (`apps/web/src/interfaces/auth-store.interface.ts`).
- **`type` only for what an interface cannot express**: unions and literal unions, in
  `types/`, suffixed `.type.ts`. `ThemeModeType`, `NotificationSocketActionType`,
  `DrawerTabType`.
- **Explicit type on every local variable**, primitives included:
  `const accessToken: string | null = …`, `const isFresh: boolean = …`,
  `const queryString: string = …`. No inferred locals.
- **Explicit return type on every exported function**, including components
  (`: ReactElement`) and hooks (`: UseXResultInterface`).
- **`any` is a lint error** (`biome.json`, `suspicious.noExplicitAny`). Use `unknown`
  and narrow — `utils/toApiError.ts` is the reference narrowing.
- **`verbatimModuleSyntax` means type-only imports are mandatory**:
  `import type { ReactElement } from 'react'`.

### One declaration per file — with two named exceptions

`interfaces/`, `types/`, `stores/`, `hooks/`, `components/` and `pages/` are strictly
one exported declaration per file. Module-private helpers in the same file are fine
and encouraged (`badgeLabel`/`bellLabel`/`liveLabel` inside `NotificationBell.tsx`,
the socket lifecycle functions inside `useNotificationSocket.ts`) — they keep the
exported unit small without creating a file nobody else imports.

Two folders group deliberately:

- **`apis/<feature>/<feature>.api.ts`** exports one function per endpoint of that
  feature, plus an `index.ts` barrel that re-exports it. The feature's endpoints move
  and get deleted together, so they live together.
- **`constants/*.constants.ts`** groups the constants of one topic
  (`notification-socket.constants.ts` holds all three reconnect knobs), because the
  values are only meaningful relative to each other.

Everything else is one export. The current outliers are
`contexts/NotificationSocketContext.tsx` (provider + its `use…Context` accessor — a
context is useless without both), `hooks/notifications/notificationSocketReducer.ts`
(reducer + its initial state) and
`apps/web/src/hooks/notifications/useNotificationPreferences.ts` (the hook + the
`buildPreferenceKey` helper its consumers need). Each is a pair that cannot be split
without inventing a file that exists only to satisfy a rule.

### Imports: relative, not aliased

**The frontends use relative imports.** Neither `apps/web/tsconfig.json` nor
`apps/admin/tsconfig.json` declares `paths`, and neither `vite.config.ts` declares a
`resolve.alias`. The only non-relative specifier in app code is the real package
`@nest-aws-starter/shared`.

This differs from the API, where path aliases (`@modules/…`) are mandatory
([`backend.md` §14](./backend.md)). Do not "fix" one to match the other in passing —
adding aliases to the frontends means touching two tsconfigs, two Vite configs and
every import in both apps, which is its own PR with its own justification.

Keep import order as Biome's organiser writes it; run `pnpm exec biome check --write`
rather than sorting by hand.

## 4. Theming

`src/styles/global.css` in each app is the whole theme, and those two files are the
only CSS in the repository (Biome deliberately ignores `**/src/styles/*.css`).

```css
:root { --surface: …; --content: …; --accent: …; --danger: …; --edge: …; }
:root[data-theme="dark"] { /* the same names, dark values */ }
@theme inline { --color-surface: var(--surface); /* … */ }
```

Three layers, three rules:

1. **Semantic tokens only.** Components use `bg-surface`, `text-content-muted`,
   `border-edge` — never a raw Tailwind palette class. There is currently **not one**
   `bg-slate-800`/`text-gray-500`-style class in either `src/`; keep it that way. A
   new colour means a new token in both `:root` blocks, not a palette class at a call
   site.
2. **The theme lives on `document.documentElement.dataset.theme`.** An inline script
   in `index.html` sets it before first paint, reading the persisted Zustand value
   (`localStorage['theme'] → JSON.parse(raw).state.mode`) and falling back to
   `prefers-color-scheme`. That script is why there is no theme flash; if you change
   the store's persist key or shape, that script changes with it. It is also the one
   inline script the Content-Security-Policy has to authorise — see below.
3. **`useThemeStore.setMode` writes the dataset attribute and the store**, in that
   order — the DOM is the source of truth for CSS, the store is the source of truth
   for React.

Anything outside CSS that needs a theme colour reads the token at runtime rather than
hardcoding it: `apps/admin/src/utils/chartColors.ts` resolves `--accent`,
`--content-muted`, `--edge` and `--danger` through `getComputedStyle`, with
light-mode fallbacks for the non-DOM case, and `useChartColors` recomputes them keyed
on the store's `mode` so a live toggle repaints mounted recharts series.

### Content-Security-Policy

Both apps ship a CSP as a `<meta http-equiv>` in the built HTML, injected by the
`inject-content-security-policy` plugin in each `vite.config.ts`. Three rules:

1. **The policy is build-only** (`apply: 'build'`). A `<meta>` tag in the source
   `index.html` would also govern `pnpm dev`, where Vite serves an inline
   React-Refresh module script, injects CSS as `<style>` elements from JS, and opens
   an HMR WebSocket — all of which a shippable policy forbids.
2. **The hash for the theme bootstrap is computed from the HTML being emitted**,
   never written by hand. Nothing to keep in sync; nothing to rot.
3. **`script-src` never gains `'unsafe-inline'` or `'unsafe-eval'`.** Everything else
   in the policy is negotiable per deployment — `img-src`/`connect-src` still allow
   `https:` because presigned S3/CloudFront URLs are minted at request time and their
   origin is not a build input. That directive is the one worth defending.

`frame-ancestors` cannot travel in a `<meta>` tag; clickjacking cover comes from the
edge (`X-Frame-Options`, `infra/terraform/modules/edge/`).

## 5. `apiClient` — one client, one refresh

`src/utils/apiClient.ts` is the only place in either app that calls `fetch` for the
API. It is small on purpose; read the whole file before changing any of it.

**Every request carries the bearer token** from `useAuthStore.getState()` — read
imperatively at call time, not through a hook, so the value is always current. A
request marked `isPublic` sends no `authorization` header. `content-type` is only set
when there is a body.

**Responses.** A non-2xx throws the parsed JSON body — the backend's error envelope
(`ApiErrorInterface`), not an `Error`. Callers funnel it through `utils/toApiError.ts`,
which passes through anything shaped like the envelope and substitutes a synthetic
`NETWORK_ERROR` otherwise, so UI code only ever branches on one type. Failures that
never reached the backend build the same shape via `utils/buildClientError.ts`. A
2xx with an empty body resolves to `undefined` rather than throwing on `JSON.parse`.

### The 401 path, precisely

```typescript
if (response.status === 401 && !options.isPublic && retryOn401) {
  const isRefreshed: boolean = await refreshTokens();

  if (isRefreshed) return performRequest<T>(options, false);

  useAuthStore.getState().clear();
}
```

Three properties fall out of those five lines, and all three are load-bearing:

- **At most one retry.** The recursive call passes `retryOn401: false`, so a second
  401 falls through to the throw. There is no loop to get stuck in.
- **A failed refresh clears the session** and then lets the original 401 envelope
  throw, so the caller still sees a real error while `AuthGate` redirects to
  `/login` on the now-null token.
- **Public requests never refresh.** A 401 from a public endpoint is a real answer.

### Single-flight refresh

```typescript
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= requestRefresh().finally((): void => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}
```

`refreshInFlight` is **module-level state**, deliberately. When a page mounts and
fires five requests with a stale access token, five 401s land at roughly the same
time. Without this, each would `POST /auth/refresh` — and since the backend rotates
the refresh token, four of those five would present an already-rotated token and fail,
logging the user out mid-session.

The mechanics, in order:

1. `??=` evaluates `requestRefresh()` **only** when the slot is null. The assignment
   is synchronous, so every caller that arrives before the first `await` resolves
   sees the same promise. No lock, no flag, no race window.
2. The slot holds the promise returned by `.finally(…)`, not the raw one — so the
   nulling happens as part of the very chain everyone awaits. The slot can never
   outlive the request it represents.
3. `finally` clears on rejection as well as fulfilment, so a network error during a
   refresh does not poison the slot for the rest of the session.
4. Waiters all receive the same `boolean`. On `true` each retries its own original
   request, which re-reads `accessToken` from the store — by then the new one.
5. The refresh call is a **bare `fetch`, not `performRequest`**. If it went through
   the client it could 401 and recurse into itself.

The single-flight property is pinned by a test — `apps/web/src/tests/apiClient.spec.ts`,
"shares a single refresh between concurrent 401s", which fires three concurrent
requests behind a 20 ms refresh and asserts the refresh endpoint was hit exactly once.
If you touch this function, that test is the one that must still pass.

## 6. Stores

Zustand, `persist`-wrapped, one store per file in `stores/`, state shape declared in
`interfaces/<name>-store.interface.ts`. There are exactly two, and that is the point:

| Store | Persist key | Holds |
|---|---|---|
| `auth.store.ts` | `auth` | `accessToken`, `refreshToken`, `user`, and `setTokens` / `setUser` / `clear` |
| `theme.store.ts` | `theme` | `mode`, and `setMode` (which also writes `documentElement.dataset.theme`) |

- **Stores hold client state, never server data.** Lists, pages and cursors live in
  the hook that fetched them. There is no global cache and no request deduplication
  layer; two components that need the same list either share a hook through a context
  or each fetch it.
- **Subscribe with a selector in components** — `useAuthStore((state) => state.accessToken)`
  — so a re-render is scoped to the slice that changed.
- **Read imperatively outside React** — `useAuthStore.getState()` in `apiClient`, in
  the socket's `auth` callback. Never call a hook from a non-component.
- **`useAuthStore.subscribe(…)` is for reacting to token rotation.** The socket hook
  uses it to notice a new access token; it returns an unsubscribe that the effect
  cleanup must call.
- **Only `clear()` ends a session.** Nothing writes `null` tokens field-by-field.

## 7. The notification socket

One socket per tab. `useNotificationSocket` owns the entire lifecycle;
`NotificationSocketProvider` mounts it once around the authenticated shell and every
consumer (`NotificationBell`, `NotificationDropdown`, `useNotificationList`) reads
from `useNotificationSocketContext()`. **No component calls `io()`.** The accessor
throws when used outside the provider rather than returning a null-ish default —
mounting a bell outside the shell is a wiring bug, not a runtime state.

Shared state is a `useReducer` over `NotificationSocketStateInterface`
(`unreadCount`, `isConnected`) with a discriminated-union action type. It is that
small on purpose: **arriving notifications are not buffered.** The dropdown and the
history page are REST-backed and refetch, so a client-side copy would be a second
source of truth for read state that nobody reads.

Lifecycle, as implemented in
`apps/web/src/hooks/notifications/useNotificationSocket.ts` (the admin copy is the
same file):

- **Connect is keyed on `hasToken`**, a boolean selector — not on the token string.
  Connecting on the string would tear down and rebuild the socket on every refresh.
- **The token is supplied through the `auth` callback**, which socket.io re-invokes on
  every connect attempt, so a reconnect always presents whatever the store holds
  *now*. It is never captured in a closure.
- **The effect returns a full teardown**: unsubscribe from the store, clear both
  timers, `removeAllListeners()`, `disconnect()`. This runs on logout, on unmount and
  on every StrictMode double-mount — leak nothing.
- **The manual-reconnect budget** (`MAX_MANUAL_RECONNECT_ATTEMPTS`) exists because the
  client does not retry an `io server disconnect`, which is exactly what the gateway's
  heartbeat sweep produces when a token goes stale. Manual reconnects back off
  exponentially from `MANUAL_RECONNECT_BASE_DELAY_MS`.
- **The budget resets on a *stable* connection, not on `connect`.** socket.io emits
  the client-side `connect` before the gateway can reject the handshake, so resetting
  there would make the bound unreachable; the reset is a `STABLE_CONNECTION_RESET_MS`
  timer instead. A rotated token also refills the budget and revives a socket that
  had given up.
- **The badge's authoritative number is REST**, polled on an interval that skips
  hidden tabs, so it keeps moving while the socket is down. The socket only
  contributes an optimistic `+1` on arrival. The gateway's `unread-count` push is
  deliberately *not* subscribed — `constants/notification-events.constants.ts` records
  why, and that comment is the contract.
- **Socket event names are duplicated, not shared.** They live in
  `constants/notification-events.constants.ts` mirroring the API's copy literal-for-
  literal, because transport metadata is not a request/response shape (see
  [`shared-contracts.md` §2](./shared-contracts.md)).

`utils/getSocketBaseUrl.ts` derives the socket origin from `VITE_API_BASE_URL` rather
than adding a second env var that could drift.

## 8. Accessibility

Interactive UI is expected to work from the keyboard and to announce itself. The
notification bell (`components/Notifications/NotificationBell.tsx`) is the reference,
and every rule below is pinned by a test in `tests/NotificationBell.spec.tsx`:

- **`aria-label` wins over button text** in the accessible-name computation, so any
  state the label hides must be spelled into the label:
  `aria-label="Notifications, 4 unread"`. The visual badge is then `aria-hidden` so
  the number is not announced twice.
- **A live region must be mounted before it has content.** A region inserted together
  with its first content announces unreliably, so the `role="status" aria-live="polite"`
  span stays in the tree at zero unread and only its text changes.
- **A popup declares itself**: `aria-expanded`, `aria-haspopup="dialog"`, and
  `aria-controls` pointing at the panel id while open. The panel is
  `role="dialog"` with an `aria-label`.
- **Escape closes and returns focus** to the trigger; opening moves focus into the
  panel. Both use a document-level listener installed only while open.
- **A full-screen outside-click catcher is pointer-only** — `tabIndex={-1}` and
  `aria-hidden`, because otherwise a keyboard user tabs into an invisible viewport-
  sized control. Escape is its keyboard equivalent.
- **Query by role in tests**, which is what forces all of the above to be real.

## 9. Testing

Vitest + jsdom + Testing Library. Specs live in each app's `src/tests/`, named after
the unit (`NotificationBell.spec.tsx`, `useAdminUsers.spec.tsx`, `apiClient.spec.ts`), and
`src/tests/setup.ts` registers `@testing-library/jest-dom` and a global `cleanup`.
Run with `pnpm --dir apps/web test`. Tests ship in the same commit series as the code.

**What to test, by layer:**

| Unit | Test | Assert |
|---|---|---|
| `components/ui/` primitive | render | Rendered roles and text for each variant/state |
| Feature component | render with props | Empty state, error state, loaded state, formatted values |
| Hook | `renderHook` with `apis/` module mocked | `result.current` after `waitFor` — the state the UI consumes |
| `apis/` module | `apiClient` mocked | The path and query string that was built |
| `utils/apiClient` | `fetch` stubbed | Header, envelope mapping, refresh behaviour |

**Assert what the user gets, not what a mock got.** The failure mode is a green test
that proves nothing:

```typescript
// ❌ passes even if the hook throws the response away
expect(usersApi.fetchAdminUsers).toHaveBeenCalled();

// ✅ the state a component would render
expect(result.current.users.map((user): string => user.id)).toEqual(['u-1', 'u-2']);
expect(result.current.hasMore).toBe(false);
```

A call assertion is legitimate only when **the call itself is the contract** — that
the cursor from page one is what page two requests, that a filter is omitted rather
than sent falsy. `apps/admin/src/tests/useAdminUsers.spec.tsx` shows the correct pairing:
`toHaveBeenLastCalledWith(20, 'u-1', '')` sits next to an assertion on the resulting
items, so neither half can pass alone.

The same trap in components: assert the rendered output, not that an `onX` prop was
invoked, whenever the render is observable. `getByRole` over `getByTestId` — a query
by role is simultaneously an accessibility assertion. `userEvent` over `fireEvent`
for anything a human does.

## 10. Code style

Biome settles formatting — quotes, commas, indentation, the 100-column limit — and
`pnpm exec biome ci .` is the arbiter. None of what follows is about how the code
looks.

**A dangling promise must look deliberate.** Where the result genuinely does not
matter, write `void refresh()` so the next reader sees a decision; a bare `refresh()`
is indistinguishable from someone forgetting the `await`, and everywhere else the
`await` belongs there.

Components, hooks and module-level helpers are `function` declarations, which keeps
them hoisted and named in stack traces; arrow functions are for callbacks passed
inline. Prefer an early return to an `else` after a `return`, and leave a blank line
before the `return`.

Logging goes through `logger` in `utils/logger.ts`, never a bare `console` — `debug`
and `warn` are stripped from production builds while `error` always fires. Comments
answer *why*: the dense blocks in `useNotificationSocket.ts` and
`notification-events.constants.ts` are the intended density for anything subtle,
because they record decisions a reader would otherwise "fix".

## 11. Anti-patterns

| Anti-pattern | Instead |
|---|---|
| `fetch` outside `utils/apiClient.ts` | An `apis/` function on the client |
| A component importing from `apis/` | Props from a page, or a hook |
| A page owning list/cursor/refetch state | A `hooks/<feature>/use…` hook |
| A hook with an inline return type | `interfaces/use-<name>-result.interface.ts` |
| Two interfaces in one file | One declaration per file (§3) |
| `const x = …` with no annotation | Explicit type on every local |
| `bg-slate-800`, `#1e293b`, any raw colour | A semantic token in `global.css` |
| A second `io()` call | `useNotificationSocketContext()` |
| Server data in a Zustand store | State in the hook that fetched it |
| `console.log` | `logger` |
| `getByTestId` where a role exists | `getByRole` |
| `expect(mock).toHaveBeenCalled()` as the only assertion | Assert the rendered output or `result.current` |
