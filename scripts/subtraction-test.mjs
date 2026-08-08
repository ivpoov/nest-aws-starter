#!/usr/bin/env node
// Modular-by-subtraction proof: for every optional module, spin up an
// isolated git worktree, delete the module, strip its cross-references
// (marked with `// <module:x>` / `// </module:x>` fences), and verify the
// rest of the app still type-checks and passes its unit tests. Also emits
// the removal recipes in docs/removal/ from the same fence markers, so the
// docs can never drift from what the script actually strips.
//
// Coverage: a module's `paths` cover apps/api, both frontends and
// packages/shared, so the recipes list every file a removal touches. The
// *verification* only extends to the frontends for modules flagged
// `frontendFenced` — the rest still need their apps/web / apps/admin /
// packages/shared cross-references converted from `manualSteps` into real
// fence markers. Those modules print a COVERAGE GAP line when they run.
//
// Usage:
//   node scripts/subtraction-test.mjs                  # run every module
//   node scripts/subtraction-test.mjs --module file     # run one module
//   node scripts/subtraction-test.mjs --module a,b      # run a subset
//   node scripts/subtraction-test.mjs --emit-docs       # (re)generate docs/removal/*.md, no worktrees
//   node scripts/subtraction-test.mjs --keep-on-failure # leave a failed worktree on disk for inspection

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A module is only removable if the whole monorepo survives its removal, so
// the fence scanner has to reach the frontends and the shared wire contracts
// too — not just the API. A module whose API half is fenced but whose React
// half is not would pass the subtraction test and still leave `apps/web`
// unable to build.
const FENCE_SCAN_ROOTS = [
  'apps/api/src',
  'apps/api/test',
  'apps/api/prisma/schema.prisma',
  'apps/api/prisma/seed.ts',
  'apps/web/src',
  'apps/admin/src',
  'packages/shared/src',
];
const FENCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.prisma']);
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', 'generated', '.git']);

// Every module the subtraction test proves removable. `paths` are
// repo-relative folders/files deleted wholesale; the fence scanner finds
// everything else (cross-module references left behind in files that
// otherwise stay).
//
// `manualSteps` are cross-references that are NOT fence-marked yet — they are
// documented for the reader but cannot be stripped mechanically.
//
// `manualPaths` are folders a removal must delete that the script deliberately
// does NOT, because doing so breaks a build step it cannot then repair. The
// `packages/shared/src/<module>` folders are all in this bucket:
// `packages/shared/src/index.ts` re-exports them and those export lines are
// not fenced, so deleting the folder alone makes `build shared` fail on a
// barrel pointing at nothing. They are still listed in the recipe — the reader
// deletes them together with the matching `index.ts` lines from `manualSteps`.
//
// `frontendFenced: true` asserts a module has nothing left in `manualPaths`
// and no `manualSteps` under apps/web, apps/admin or packages/shared, which is
// what lets the runner type-check and unit-test both frontends after the
// subtraction. Until a module earns that flag its frontend half is deleted but
// unverified, and the runner prints a COVERAGE GAP line for it.
const MODULES = [
  {
    id: 'contact-us',
    summary: 'Public contact form + admin inbox.',
    paths: [
      'apps/api/src/modules/contact-us',
      'apps/web/src/apis/contact',
      'apps/web/src/interfaces/submit-contact-request.interface.ts',
      'apps/web/src/pages/ContactPage.tsx',
      'apps/web/src/tests/ContactPage.spec.tsx',
      'apps/admin/src/apis/contact',
      'apps/admin/src/components/Contact',
      'apps/admin/src/hooks/contact',
      'apps/admin/src/interfaces/use-contact-messages-result.interface.ts',
      'apps/admin/src/interfaces/use-contact-message-status-result.interface.ts',
      'apps/admin/src/pages/InboxPage.tsx',
      'apps/admin/src/tests/ContactMessageDrawer.spec.tsx',
      'apps/admin/src/tests/InboxPage.spec.tsx',
      'apps/admin/src/tests/useContactMessages.spec.tsx',
    ],
    envVars: [],
    manualPaths: ['packages/shared/src/contact'],
    manualSteps: [
      ['apps/web/src/App.tsx', 'the ContactPage import and the /contact route'],
      [
        'apps/web/src/components/Layout/AppLayout.tsx',
        'the "Contact us" footer link (the <footer> is then empty)',
      ],
      ['apps/web/src/pages/LoginPage.tsx + RegisterPage.tsx', 'the "Contact" links'],
      ['apps/admin/src/App.tsx', 'the InboxPage import and the /inbox route'],
      ['apps/admin/src/components/Layout/AdminLayout.tsx', 'the Inbox nav entry'],
      [
        'apps/admin/src/utils/resolveNotificationLink.ts',
        'CONTACT_MESSAGE is its only branch — the function reduces to `return null`',
      ],
      ['packages/shared/src/index.ts', "the `export * from './contact/...'` lines"],
      [
        'packages/shared/src/notifications/enums/notification-type.enum.ts',
        "the CONTACT_MESSAGE member — coupled with both apps' NOTIFICATION_TYPE_LABELS entries, which are total Records over this enum",
      ],
    ],
  },
  {
    id: 'statistic',
    summary: 'Admin dashboard statistics (cached TypedSQL aggregates).',
    paths: [
      'apps/api/src/modules/statistic',
      'apps/api/prisma/sql',
      'apps/admin/src/apis/statistics',
      'apps/admin/src/components/Statistics',
      'apps/admin/src/hooks/statistics',
      'apps/admin/src/constants/statistics.constants.ts',
      'apps/admin/src/interfaces/chart-colors.interface.ts',
      'apps/admin/src/interfaces/use-statistics-overview-result.interface.ts',
      'apps/admin/src/interfaces/use-statistics-series-result.interface.ts',
      'apps/admin/src/pages/StatisticsPage.tsx',
      'apps/admin/src/utils/chartColors.ts',
      'apps/admin/src/utils/formatMoney.ts',
      'apps/admin/src/tests/AuthMethodBreakdown.spec.tsx',
      'apps/admin/src/tests/KpiTiles.spec.tsx',
      'apps/admin/src/tests/RegistrationsChart.spec.tsx',
      'apps/admin/src/tests/RevenueByPlanBreakdown.spec.tsx',
      'apps/admin/src/tests/RevenueChart.spec.tsx',
      'apps/admin/src/tests/StatisticsPage.spec.tsx',
      'apps/admin/src/tests/UsersByStatusBreakdown.spec.tsx',
      'apps/admin/src/tests/useChartColors.spec.tsx',
      'apps/admin/src/tests/useStatisticsOverview.spec.tsx',
      'apps/admin/src/tests/useStatisticsSeries.spec.tsx',
    ],
    envVars: [],
    manualPaths: ['packages/shared/src/statistics'],
    manualSteps: [
      [
        'apps/admin/src/App.tsx',
        'the StatisticsPage import and the /dashboard route — AND repoint the catch-all <Navigate to="/dashboard">, which is a RUNTIME break, not a type error',
      ],
      [
        'apps/admin/src/pages/LoginPage.tsx',
        'repoint the post-login navigate away from /dashboard — also runtime-only',
      ],
      ['apps/admin/src/components/Layout/AdminLayout.tsx', 'the Dashboard nav entry'],
      ['packages/shared/src/index.ts', "the `export * from './statistics/...'` lines"],
    ],
  },
  {
    id: 'api-key',
    summary: 'Long-lived API key issuance, guard, and admin management.',
    paths: ['apps/api/src/modules/api-key'],
    manualPaths: ['packages/shared/src/api-keys'],
    envVars: [],
    manualSteps: [
      ['packages/shared/src/index.ts', "the `export * from './api-keys/...'` lines"],
      ['apps/web, apps/admin', 'nothing — this module has no frontend surface'],
    ],
  },
  {
    id: 'file',
    summary: 'S3-backed presigned upload/download flow.',
    paths: [
      'apps/api/src/modules/file',
      'apps/web/src/apis/files',
      'apps/web/src/components/Attachments',
      'apps/web/src/hooks/files',
      'apps/web/src/interfaces/uploaded-file.interface.ts',
      'apps/web/src/interfaces/use-file-upload-result.interface.ts',
      'apps/web/src/types/file-upload-status.type.ts',
      'apps/web/src/tests/AttachmentsCard.spec.tsx',
      'apps/web/src/tests/useFileUpload.spec.tsx',
    ],
    envVars: [],
    manualSteps: [
      [
        'apps/web/src/pages/NotesPage.tsx',
        'the useFileUpload / AttachmentsCard imports, the hook call and the <AttachmentsCard> render',
      ],
      [
        'packages/shared/src/files',
        'delete everything EXCEPT enums/file-intent.enum.ts, and reduce that enum to AVATAR — the avatar flow (ProfilePage, useProfile) needs FileIntentEnum and survives this module',
      ],
      [
        'apps/web/src/constants/file-upload.constants.ts',
        'the ATTACHMENT entries only — the AVATAR entries are used by ProfilePage',
      ],
      ['packages/shared/src/index.ts', 'the ./files/* export lines except the file-intent enum'],
      [
        'apps/web/src/utils/validateFileUpload.ts + apiClient.ts',
        'keep both — the avatar upload path uses them',
      ],
    ],
  },
  {
    id: 'oauth-google',
    summary: 'Google OAuth login/link provider.',
    paths: ['apps/api/src/modules/oauth-google', 'apps/api/src/configs/google-oauth.config.ts'],
    // No frontend or packages/shared surface at all, so both frontends are
    // fully verified after this subtraction.
    frontendFenced: true,
    envVars: [
      'GOOGLE_OAUTH_ENABLED',
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REDIRECT_URI',
    ],
  },
  {
    id: 'oauth-facebook',
    summary: 'Facebook OAuth login/link provider.',
    paths: ['apps/api/src/modules/oauth-facebook', 'apps/api/src/configs/facebook-oauth.config.ts'],
    // No frontend or packages/shared surface at all, so both frontends are
    // fully verified after this subtraction.
    frontendFenced: true,
    envVars: [
      'FACEBOOK_OAUTH_ENABLED',
      'FACEBOOK_OAUTH_CLIENT_ID',
      'FACEBOOK_OAUTH_CLIENT_SECRET',
      'FACEBOOK_OAUTH_REDIRECT_URI',
    ],
  },
  {
    id: 'oauth-discord',
    summary: 'Discord OAuth login/link provider.',
    paths: ['apps/api/src/modules/oauth-discord', 'apps/api/src/configs/discord-oauth.config.ts'],
    // No frontend or packages/shared surface at all, so both frontends are
    // fully verified after this subtraction.
    frontendFenced: true,
    envVars: [
      'DISCORD_OAUTH_ENABLED',
      'DISCORD_OAUTH_CLIENT_ID',
      'DISCORD_OAUTH_CLIENT_SECRET',
      'DISCORD_OAUTH_REDIRECT_URI',
    ],
  },
  {
    id: 'cloudfront',
    summary: 'CloudFront signed download URLs (optional common provider).',
    paths: [
      'apps/api/src/modules/common/providers/cloudfront',
      'apps/api/src/configs/cloudfront.config.ts',
    ],
    // No frontend or packages/shared surface at all, so both frontends are
    // fully verified after this subtraction.
    frontendFenced: true,
    envVars: [
      'CLOUDFRONT_ENABLED',
      'CLOUDFRONT_DOMAIN',
      'CLOUDFRONT_KEY_PAIR_ID',
      'CLOUDFRONT_PRIVATE_KEY',
      'CLOUDFRONT_URL_TTL_SEC',
    ],
  },
  {
    id: 'payment',
    summary:
      'Plans, subscriptions, payment transactions, webhook events, and the Stripe provider ' +
      '(schema + core module + Stripe implementation).',
    paths: [
      'apps/api/src/modules/payment',
      'apps/api/src/modules/stripe',
      'apps/api/src/configs/stripe.config.ts',
      'apps/api/src/configs/payment.config.ts',
      // Revenue TypedSQL reads payment_transactions/subscriptions/plans
      // directly (statistic module's own repository, not a feature import —
      // see docs/conventions/backend.md's TypedSQL section) — the tables
      // vanish with the module, so the SQL files must too. Whole-file
      // deletion here; their repository/service call sites are fenced
      // instead (apps/api/src/modules/statistic).
      'apps/api/prisma/sql/revenueByDay.sql',
      'apps/api/prisma/sql/mrrCurrent.sql',
      'apps/api/prisma/sql/revenueByPlan.sql',
      // Whole e2e specs that exist solely to exercise payment endpoints —
      // partial specs that merely touch payment (maintenance-jobs,
      // statistics) are handled by fence markers instead, since most of
      // their content is non-payment.
      'apps/api/test/billing.e2e-spec.ts',
      'apps/api/test/plans-admin.e2e-spec.ts',
      'apps/api/test/transactions.e2e-spec.ts',
      'apps/api/test/webhooks.e2e-spec.ts',
      'apps/api/test/webhook-consumer.e2e-spec.ts',
      'apps/api/test/subscription-access.e2e-spec.ts',
      'apps/api/test/subscription-lifecycle.e2e-spec.ts',
      'apps/web/src/apis/billing',
      'apps/web/src/components/Billing',
      'apps/web/src/hooks/billing',
      'apps/web/src/constants/billing.constants.ts',
      'apps/web/src/interfaces/use-billing-subscription-result.interface.ts',
      'apps/web/src/interfaces/use-checkout-result.interface.ts',
      'apps/web/src/interfaces/use-public-plans-result.interface.ts',
      'apps/web/src/pages/BillingCanceledPage.tsx',
      'apps/web/src/pages/BillingPage.tsx',
      'apps/web/src/pages/BillingSuccessPage.tsx',
      'apps/web/src/pages/PricingPage.tsx',
      'apps/web/src/utils/formatBillingInterval.ts',
      'apps/web/src/utils/formatMoney.ts',
      'apps/web/src/tests/BillingSuccessPage.spec.tsx',
      'apps/web/src/tests/useBillingSubscription.spec.ts',
      'apps/web/src/tests/useCheckout.spec.ts',
      'apps/web/src/tests/usePublicPlans.spec.ts',
      'apps/admin/src/apis/plans',
      'apps/admin/src/apis/transactions',
      'apps/admin/src/components/Plans',
      'apps/admin/src/components/Transactions',
      'apps/admin/src/hooks/plans',
      'apps/admin/src/hooks/transactions',
      'apps/admin/src/interfaces/transaction-filters.interface.ts',
      'apps/admin/src/interfaces/use-admin-plans-result.interface.ts',
      'apps/admin/src/interfaces/use-plan-mutations-result.interface.ts',
      'apps/admin/src/interfaces/use-transaction-filters-result.interface.ts',
      'apps/admin/src/interfaces/use-transaction-list-result.interface.ts',
      'apps/admin/src/pages/PlansPage.tsx',
      'apps/admin/src/pages/TransactionsPage.tsx',
      'apps/admin/src/tests/PlanFormModal.spec.tsx',
      'apps/admin/src/tests/PlanRowActions.spec.tsx',
      'apps/admin/src/tests/TransactionFilterBar.spec.tsx',
      'apps/admin/src/tests/TransactionList.spec.tsx',
      'apps/admin/src/tests/useAdminPlans.spec.tsx',
      'apps/admin/src/tests/useTransactionFilters.spec.tsx',
      // These live under the statistic tree, but every consumer path is
      // revenue — they become unreferenced the moment payment's tables go.
      'apps/admin/src/components/Statistics/RevenueChart.tsx',
      'apps/admin/src/components/Statistics/RevenueByPlanBreakdown.tsx',
      'apps/admin/src/tests/RevenueChart.spec.tsx',
      'apps/admin/src/tests/RevenueByPlanBreakdown.spec.tsx',
    ],
    envVars: [
      'STRIPE_ENABLED',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PORTAL_RETURN_URL',
      'SQS_PAYMENT_WEBHOOK_QUEUE_URL',
      'PAYMENT_WEBHOOK_CONSUMER_ENABLED',
    ],
    manualPaths: ['packages/shared/src/payments'],
    manualSteps: [
      [
        'apps/web/src/App.tsx',
        'the billing/pricing page imports and the /pricing, /billing/success, /billing/canceled and /settings/billing routes',
      ],
      ['apps/web/src/components/Layout/AppLayout.tsx', 'the Billing nav entry'],
      ['apps/web/src/pages/LoginPage.tsx + RegisterPage.tsx', 'the "Pricing" links'],
      [
        'apps/web/src/utils/resolveNotificationLink.ts',
        'the PAYMENT_FAILED / SUBSCRIPTION_* branches',
      ],
      ['apps/admin/src/App.tsx', 'the plans/transactions page imports and their routes'],
      [
        'apps/admin/src/components/Layout/AdminLayout.tsx',
        'the Plans and Transactions nav entries',
      ],
      [
        'apps/admin/src/pages/StatisticsPage.tsx',
        'the RevenueChart / RevenueByPlanBreakdown imports, the revenue series state and their render blocks',
      ],
      ['packages/shared/src/index.ts', "the `export * from './payments/...'` lines"],
      [
        'packages/shared/src/notifications/enums/notification-type.enum.ts',
        "the payment notification types — coupled: both apps' NOTIFICATION_TYPE_LABELS are total Records over this enum, so members and label lines must go together",
      ],
      [
        'apps/admin/src/components/Statistics/KpiTiles.tsx',
        'no edit needed — it already renders a placeholder when revenue is null',
      ],
    ],
  },
  {
    // Task 1 shipped schema-only (no module folder). Task 2 (this round)
    // adds the Socket.IO gateway — its own module folder plus e2e spec are
    // included here in the same commit series (see task-1-report.md's note
    // for PR 2-5 implementers: v0.4's payment entry missed this once and
    // briefly broke the subtracted tree). Tasks 3-5 extend `paths` further
    // as the dispatcher/history API/email digest land in the same folder.
    id: 'notification',
    summary:
      'Notification/receipt/preference schema, WS gateway, the persist-first dispatcher (IN_APP + ' +
      'the per-type/per-channel EMAIL gate, PR 5), the history API ' +
      '(list/unread-count/mark-read/read-all), and the preferences API (GET/PUT matrix).',
    paths: [
      'apps/api/src/modules/notification',
      'apps/api/src/configs/websocket.config.ts',
      'apps/api/test/websocket.e2e-spec.ts',
      'apps/api/test/notification-dispatcher.e2e-spec.ts',
      'apps/api/test/notification-api.e2e-spec.ts',
      'apps/api/test/notification-preferences.e2e-spec.ts',
      'apps/web/src/apis/notifications',
      'apps/web/src/components/Notifications',
      'apps/web/src/hooks/notifications',
      'apps/web/src/contexts/NotificationSocketContext.tsx',
      'apps/web/src/pages/NotificationPreferencesPage.tsx',
      'apps/web/src/constants/notification-channel-labels.constants.ts',
      'apps/web/src/constants/notification-events.constants.ts',
      'apps/web/src/constants/notification-list.constants.ts',
      'apps/web/src/constants/notification-socket.constants.ts',
      'apps/web/src/constants/notification-unread-count-poll.constants.ts',
      'apps/web/src/constants/notification-type-labels.constants.ts',
      'apps/web/src/interfaces/notification-socket-state.interface.ts',
      'apps/web/src/interfaces/use-notification-list-result.interface.ts',
      'apps/web/src/interfaces/use-notification-preferences-result.interface.ts',
      'apps/web/src/interfaces/use-notification-socket-result.interface.ts',
      'apps/web/src/types/notification-socket-action.type.ts',
      'apps/web/src/utils/getSocketBaseUrl.ts',
      'apps/web/src/utils/resolveNotificationLink.ts',
      'apps/web/src/tests/NotificationBell.spec.tsx',
      'apps/web/src/tests/NotificationDropdown.spec.tsx',
      'apps/web/src/tests/PreferencesGrid.spec.tsx',
      'apps/web/src/tests/notificationSocketReducer.spec.ts',
      'apps/web/src/tests/notificationsApi.spec.ts',
      'apps/web/src/tests/resolveNotificationLink.spec.ts',
      'apps/web/src/tests/useNotificationList.spec.ts',
      'apps/web/src/tests/useNotificationPreferences.spec.ts',
      'apps/web/src/tests/useNotificationSocket.spec.ts',
      'apps/admin/src/apis/notifications',
      'apps/admin/src/components/Notifications',
      'apps/admin/src/hooks/notifications',
      'apps/admin/src/contexts/NotificationSocketContext.tsx',
      'apps/admin/src/pages/NotificationHistoryPage.tsx',
      'apps/admin/src/constants/notification-events.constants.ts',
      'apps/admin/src/constants/notification-history.constants.ts',
      'apps/admin/src/constants/notification-socket.constants.ts',
      'apps/admin/src/constants/notification-unread-count-poll.constants.ts',
      'apps/admin/src/interfaces/notification-history-filters.interface.ts',
      'apps/admin/src/interfaces/notification-socket-state.interface.ts',
      'apps/admin/src/interfaces/use-notification-history-filters-result.interface.ts',
      'apps/admin/src/interfaces/use-notification-list-result.interface.ts',
      'apps/admin/src/interfaces/use-notification-socket-result.interface.ts',
      'apps/admin/src/types/notification-socket-action.type.ts',
      'apps/admin/src/utils/getSocketBaseUrl.ts',
      'apps/admin/src/utils/resolveNotificationLink.ts',
      'apps/admin/src/tests/NotificationBell.spec.tsx',
      'apps/admin/src/tests/NotificationDropdown.spec.tsx',
      'apps/admin/src/tests/NotificationHistoryPage.spec.tsx',
      'apps/admin/src/tests/notificationsApi.spec.ts',
      'apps/admin/src/tests/notificationSocketReducer.spec.ts',
      'apps/admin/src/tests/resolveNotificationLink.spec.ts',
      'apps/admin/src/tests/useNotificationHistoryFilters.spec.tsx',
      'apps/admin/src/tests/useNotificationList.spec.tsx',
      'apps/admin/src/tests/useNotificationSocket.spec.tsx',
      'packages/shared/src/notifications',
    ],
    envVars: ['WEBSOCKET_ENABLED', 'WEBSOCKET_HEARTBEAT_INTERVAL_MS'],
    frontendFenced: true,
    manualSteps: [
      [
        'apps/admin/src/pages/InboxPage.tsx + UsersPage.tsx + ActivitiesPage.tsx',
        'comments only — they explain why each page re-syncs its deep-link query param on every change. The `?messageId=` / `?userId=` / `?type=` handling itself stays and keeps working; nothing here breaks the build',
      ],
      ['apps/api/test/vitest.e2e.config.ts', 'the WEBSOCKET_* env pins'],
      ['turbo.json', 'the WEBSOCKET_* entries in the test:e2e env allowlist'],
      [
        'apps/api/package.json + apps/web/package.json + apps/admin/package.json',
        'the socket.io / @socket.io/redis-adapter / @nestjs/websockets / @nestjs/platform-socket.io dependencies, then re-run pnpm install',
      ],
    ],
  },
];

// Documented for docs/removal/README.md — investigated during Task 14 and
// found not (currently) cleanly removable. Not exercised by the script.
const NON_REMOVABLE = [
  {
    id: 'suspicious-activity',
    reason:
      'Fenceable in principle — multi-line/block fences exist elsewhere in this PR — ' +
      'but disproportionately invasive here: it is a synchronous security gate inside ' +
      'AuthService.login() (LoginLockoutService.assertNotLocked() blocks credential ' +
      'verification; NewDeviceService.check() branches AUTH_NEW_DEVICE_EVENT emission), ' +
      'and fencing it would touch most of auth.service.spec.ts (six of its test cases ' +
      'exist solely to assert this ordering). Removing a login-hardening module should ' +
      'never be a quiet one-line subtraction that silently weakens auth — so it is ' +
      'deliberately kept non-removable rather than fenced.',
  },
  {
    id: 'activity',
    reason:
      'Subscribes to core auth/user events (AUTH_LOGIN, USER_BLOCKED, ...) that ' +
      'survive regardless of which optional modules are present; it is the audit ' +
      'trail for the core system, not an optional feature.',
  },
  { id: 'user', reason: 'Core identity module.' },
  { id: 'auth', reason: 'Core authentication module.' },
  { id: 'session', reason: 'Core session module.' },
  { id: 'token', reason: 'Core token module.' },
  { id: 'casl', reason: 'Core authorization module.' },
  { id: 'event', reason: 'Core event bus.' },
  { id: 'common', reason: 'Shared infrastructure (errors, guards, decorators, cache, ...).' },
  {
    id: 'oauth (core)',
    reason:
      'The oauth flow/registry/state-store module — not a provider itself. ' +
      'user-admin.controller (login-as) depends on OauthFlowService.mintExchangeCode ' +
      'directly. Only the oauth-* provider plugins (google/facebook/discord) are removable.',
  },
  {
    id: 's3 / sqs / sns / mail / lambda (providers)',
    reason:
      'v0.1 providers predate the fence-marker convention introduced in this PR. ' +
      'Retrofitting them is deliberately out of scope for this round — see the ' +
      'per-provider coupling notes in docs/removal/README.md — and belongs to a dedicated pass.',
  },
];

// Per-provider investigation backing the v0.1-provider scope cut above —
// grepped each provider's injection token for consumers outside its own
// module before writing these, so the notes describe the actual coupling
// shape rather than a blanket "predates the convention" excuse.
const DEFERRED_PROVIDERS = [
  {
    id: 's3',
    note:
      'Coupled beyond the file module: `ProfileService` (avatar upload/download URLs) and ' +
      '`OauthAvatarListener` (OAuth avatar sync) — both in the core `user` module — call ' +
      '`S3_PROVIDER` unconditionally, with no `isEnabled` branch at the call site (the branch ' +
      'lives one level down, in the DI factory that swaps in `DisabledS3ProviderService`). ' +
      'Removing S3 outright means refactoring those two core call sites, not deleting a ' +
      "removable module's reference to it.",
  },
  {
    id: 'sqs',
    note:
      'No domain-layer consumers found — nothing outside its own module and ' +
      '`test/sqs.e2e-spec.ts` (which pulls `SQS_PROVIDER` straight out of the DI container) ' +
      'references it. Removal would be as mechanical as an `oauth-*` provider (module + ' +
      'config + `app.module.ts` lines + its e2e spec) — simply not yet ported to the ' +
      'fence-marker convention this round.',
  },
  {
    id: 'sns',
    note:
      'Same shape as sqs: no domain-layer consumers, only its own module and ' +
      '`test/sns.e2e-spec.ts` reference `SNS_PROVIDER` directly. Mechanical to fence; not ' +
      'yet ported this round.',
  },
  {
    id: 'mail',
    note:
      'Coupled into core auth: `EmailFlowService` (verify/reset emails, `auth` module) calls ' +
      '`MAIL_TRANSPORT` unconditionally; `NewDeviceService` (`suspicious-activity`) also ' +
      "injects it directly, gated only by its own `newDeviceEmailEnabled` flag, not by mail's " +
      "own `isEnabled`. `NotificationEmailService` (`notification`, PR 5) checks mail's own " +
      '`isEnabled` before every send, so it degrades cleanly — but it is still a removable ' +
      "module's unconditional dependency on this deferred provider. Removing mail outright " +
      'breaks core auth email flows.',
  },
  {
    id: 'lambda',
    note:
      'Same shape as sqs/sns: no domain-layer consumers — `test/lambda.e2e-spec.ts` pulls ' +
      '`LAMBDA_PROVIDER` straight out of the DI container to invoke the example function. ' +
      'Mechanical to fence; not yet ported this round.',
  },
];

function log(message) {
  process.stdout.write(`${message}\n`);
}

const FRONTEND_PATH_PREFIXES = ['apps/web/', 'apps/admin/', 'packages/shared/'];

function hasFrontendPaths(module) {
  return [...module.paths, ...(module.manualPaths ?? [])].some((p) =>
    FRONTEND_PATH_PREFIXES.some((prefix) => p.startsWith(prefix)),
  );
}

// A recipe that names a file which no longer exists is worse than no recipe:
// the reader assumes they mis-followed it. The generated docs list `paths`
// verbatim, so refuse to emit or run against a stale entry.
function assertModulePathsExist(modules) {
  const stale = [];

  for (const module of modules) {
    for (const relPath of [...module.paths, ...(module.manualPaths ?? [])]) {
      if (!statSync(path.join(REPO_ROOT, relPath), { throwIfNoEntry: false })) {
        stale.push(`${module.id}: ${relPath}`);
      }
    }
  }

  if (stale.length > 0) {
    throw new Error(
      `MODULES lists paths that no longer exist — update scripts/subtraction-test.mjs:\n  ${stale.join('\n  ')}`,
    );
  }
}

function parseArgs(argv) {
  const args = { modules: null, emitDocs: false, keepOnFailure: false };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--module') {
      args.modules = argv[i + 1].split(',').map((id) => id.trim());
      i += 1;
    } else if (argv[i] === '--emit-docs') {
      args.emitDocs = true;
    } else if (argv[i] === '--keep-on-failure') {
      args.keepOnFailure = true;
    }
  }

  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
  });

  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function listFilesRecursive(rootAbsPath) {
  const stat = statSync(rootAbsPath, { throwIfNoEntry: false });

  if (!stat) return [];
  if (stat.isFile()) return [rootAbsPath];

  const entries = readdirSync(rootAbsPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      files.push(...listFilesRecursive(path.join(rootAbsPath, entry.name)));
      continue;
    }

    if (FENCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(rootAbsPath, entry.name));
    }
  }

  return files;
}

function fenceFilesUnder(treeRoot) {
  return FENCE_SCAN_ROOTS.flatMap((relRoot) => listFilesRecursive(path.join(treeRoot, relRoot)));
}

// Deletes every line fenced for `moduleId`: single lines carrying a trailing
// `// <module:x>` marker, and whole blocks between own-line
// `// <module:x>` / `// </module:x>` markers. Returns the fence hits found
// (used by --emit-docs) and, when `write` is true, persists the stripped file.
function stripFencesInFile(filePath, moduleId, write) {
  // `//` fences cover .ts/.prisma; the `{/* */}` variants exist because a
  // line comment is a syntax error inside JSX children, which is exactly
  // where a frontend cross-reference lives (a <Bell /> inside a layout).
  const startMarkers = [`// <module:${moduleId}>`, `{/* <module:${moduleId}> */}`];
  const endMarkers = [`// </module:${moduleId}>`, `{/* </module:${moduleId}> */}`];
  const original = readFileSync(filePath, 'utf8');
  const lines = original.split('\n');
  const kept = [];
  const hits = [];
  let inBlock = false;
  let blockStartLine = -1;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (startMarkers.includes(trimmed)) {
      inBlock = true;
      blockStartLine = index + 1;

      return;
    }

    if (endMarkers.includes(trimmed)) {
      inBlock = false;
      hits.push({ kind: 'block', startLine: blockStartLine, endLine: index + 1 });

      return;
    }

    if (inBlock) return;

    if (startMarkers.some((marker) => line.includes(marker))) {
      hits.push({ kind: 'line', startLine: index + 1, endLine: index + 1, preview: line.trim() });

      return;
    }

    kept.push(line);
  });

  if (write && hits.length > 0) writeFileSync(filePath, kept.join('\n'));

  return hits;
}

function scanFences(treeRoot, moduleId, write) {
  const results = [];

  for (const filePath of fenceFilesUnder(treeRoot)) {
    const hits = stripFencesInFile(filePath, moduleId, write);

    if (hits.length > 0) {
      results.push({ file: path.relative(treeRoot, filePath), hits });
    }
  }

  return results;
}

function deleteModulePaths(treeRoot, modulePaths) {
  for (const relPath of modulePaths) {
    rmSync(path.join(treeRoot, relPath), { recursive: true, force: true });
  }
}

function createWorktree(moduleId) {
  const tmpParent = mkdtempSync(path.join(tmpdir(), 'subtraction-'));
  const dir = path.join(tmpParent, moduleId);
  const branch = `subtraction/${moduleId}-${randomUUID().slice(0, 8)}`;
  const result = run('git', ['worktree', 'add', '-b', branch, dir, 'HEAD']);

  if (result.status !== 0) {
    // `git worktree add` failed before creating anything worth tracking —
    // the mkdtemp parent would otherwise leak forever, unlike a failure
    // further down the pipeline (which removeWorktree cleans up).
    rmSync(tmpParent, { recursive: true, force: true });

    throw new Error(`git worktree add failed for ${moduleId}:\n${result.output}`);
  }

  return { dir, tmpParent, branch };
}

function removeWorktree(worktree) {
  run('git', ['worktree', 'remove', '--force', worktree.dir]);
  run('git', ['branch', '-D', worktree.branch]);
  rmSync(worktree.tmpParent, { recursive: true, force: true });
}

// Prisma's generated client/TypedSQL output isn't checked in. `prisma
// generate --sql` needs a live database, which per-module worktrees don't
// get — so the primary tree's already-built generated/ dir is copied in
// verbatim instead. Nothing in a fenced-down worktree can add a Prisma
// model, so a client generated from the FULL schema type-checks identically
// for whatever subset of modules remains (removed modules' generated types
// simply go unused once their importing files are deleted).
// Returns the same {status, output} shape as run() (never throws) so a
// missing source dir (script run before `pnpm run build`) or any other I/O
// error surfaces as an ordinary failed step — caught by runModule's loop,
// which still calls removeWorktree() — rather than an uncaught exception
// that would crash the whole run mid-worktree and skip cleanup.
function copyGeneratedPrismaClient(worktreeDir) {
  const source = path.join(REPO_ROOT, 'apps/api/src/generated');
  const dest = path.join(worktreeDir, 'apps/api/src/generated');

  try {
    cpSync(source, dest, { recursive: true });

    return { status: 0, output: '' };
  } catch (error) {
    return { status: 1, output: String(error) };
  }
}

// The frontend half of a removal: `tsc --noEmit` catches imports of deleted
// modules that `apps/api`'s own type-check can never see, and the vitest run
// catches specs left behind referencing removed components.
function frontendSteps(worktreeDir, appDir) {
  return [
    [
      `${appDir} tsc --noEmit`,
      () =>
        run('pnpm', ['--dir', appDir, 'exec', 'tsc', '--noEmit', '-p', 'tsconfig.json'], {
          cwd: worktreeDir,
        }),
    ],
    [
      `${appDir} unit tests`,
      () => run('pnpm', ['--dir', appDir, 'run', 'test'], { cwd: worktreeDir }),
    ],
  ];
}

function subtractionSteps(worktreeDir, module) {
  return [
    ['install', () => run('pnpm', ['install', '--frozen-lockfile'], { cwd: worktreeDir })],
    [
      'build shared',
      () => run('pnpm', ['--dir', 'packages/shared', 'run', 'build'], { cwd: worktreeDir }),
    ],
    ['copy generated prisma client', () => copyGeneratedPrismaClient(worktreeDir)],
    [
      'tsc --noEmit',
      () =>
        run('pnpm', ['--dir', 'apps/api', 'exec', 'tsc', '--noEmit', '-p', 'tsconfig.build.json'], {
          cwd: worktreeDir,
        }),
    ],
    ['unit tests', () => run('pnpm', ['--dir', 'apps/api', 'run', 'test'], { cwd: worktreeDir })],
    ...(module.frontendFenced ? frontendSteps(worktreeDir, 'apps/web') : []),
    ...(module.frontendFenced ? frontendSteps(worktreeDir, 'apps/admin') : []),
  ];
}

function runModule(module, keepOnFailure) {
  log(`\n=== ${module.id} ===`);

  if (!module.frontendFenced && hasFrontendPaths(module)) {
    log(
      `  COVERAGE GAP  deletes frontend/shared files, but its cross-references there are ` +
        'not fence-marked — apps/web + apps/admin are NOT verified for this module ' +
        `(see the "not yet fence-marked" section of docs/removal/${module.id}.md).`,
    );
  }

  const worktree = createWorktree(module.id);

  deleteModulePaths(worktree.dir, module.paths);
  scanFences(worktree.dir, module.id, true);

  for (const [name, step] of subtractionSteps(worktree.dir, module)) {
    const result = step();

    if (result.status !== 0) {
      log(`FAIL  ${module.id}  (${name})`);
      log(result.output.split('\n').slice(-80).join('\n'));

      if (!keepOnFailure) removeWorktree(worktree);

      return {
        id: module.id,
        pass: false,
        worktree: keepOnFailure ? worktree : null,
        failedStep: name,
      };
    }

    log(`  ok  ${name}`);
  }

  log(`PASS  ${module.id}`);
  removeWorktree(worktree);

  return { id: module.id, pass: true };
}

function selectModules(filterIds) {
  if (!filterIds) return MODULES;

  const selected = MODULES.filter((module) => filterIds.includes(module.id));
  const unknown = filterIds.filter((id) => !MODULES.some((module) => module.id === id));

  if (unknown.length > 0) {
    throw new Error(`Unknown module id(s): ${unknown.join(', ')}`);
  }

  return selected;
}

function renderEnvVarsSection(envVars) {
  if (envVars.length === 0) return '_No dedicated `.env` variables._';

  return envVars.map((name) => `- \`${name}\``).join('\n');
}

function renderFenceSection(fenceResults) {
  if (fenceResults.length === 0) {
    return '_No cross-module references to strip — the module is self-contained._';
  }

  return fenceResults
    .map(({ file, hits }) => {
      const hitLines = hits
        .map((hit) =>
          hit.kind === 'block'
            ? `  - lines ${hit.startLine}-${hit.endLine} (block)`
            : `  - line ${hit.startLine}: \`${hit.preview}\``,
        )
        .join('\n');

      return `- \`${file}\`\n${hitLines}`;
    })
    .join('\n');
}

function renderManualStepsSection(manualSteps) {
  if (!manualSteps || manualSteps.length === 0) {
    return '_None — every cross-module reference for this module is fence-marked._';
  }

  return manualSteps.map(([file, what]) => `- \`${file}\` — ${what}`).join('\n');
}

// Pulls the Prisma models/enums out of the module's own fenced block in
// schema.prisma, so the database section names exactly what the fence
// deletion takes with it and can never drift from the schema.
function prismaObjectsFor(moduleId) {
  const schemaPath = path.join(REPO_ROOT, 'apps/api/prisma/schema.prisma');
  const startMarker = `// <module:${moduleId}>`;
  const endMarker = `// </module:${moduleId}>`;
  const objects = [];
  let inBlock = false;

  for (const line of readFileSync(schemaPath, 'utf8').split('\n')) {
    const trimmed = line.trim();

    if (trimmed === startMarker) {
      inBlock = true;
      continue;
    }

    if (trimmed === endMarker) {
      inBlock = false;
      continue;
    }

    if (!inBlock) continue;

    const match = trimmed.match(/^(model|enum)\s+(\w+)/);

    if (match) objects.push(`${match[1]} \`${match[2]}\``);
  }

  return objects;
}

function renderDatabaseSection(moduleId) {
  const objects = prismaObjectsFor(moduleId);

  if (objects.length === 0) {
    return '_This module owns no Prisma models — there is nothing to migrate._';
  }

  return `Stripping the fenced block in \`apps/api/prisma/schema.prisma\` (section 2) removes
${objects.join(', ')}.

Prisma migrations are an append-only history, so **editing the schema does not drop
anything from a database that already ran those migrations** — you have to say what
should happen to the existing tables. Pick one:

- **No deployed database yet** (the usual case for a fresh clone): delete
  \`apps/api/prisma/migrations/\` outright and re-baseline with a single migration —
  \`pnpm --dir apps/api exec prisma migrate dev --name init\`.
- **An existing database you need to keep**: leave the history alone and add a drop
  migration — \`pnpm --dir apps/api exec prisma migrate dev --name drop_${moduleId.replace(/-/g, '_')}\`.
  Read the generated SQL before applying it anywhere real: it will \`DROP TABLE\` the
  models above, which is irreversible and takes their rows with it.`;
}

function renderModuleDoc(module) {
  const fenceResults = scanFences(REPO_ROOT, module.id, false);
  const pathsSection = [
    ...module.paths.map((p) => `- \`${p}\` (delete)`),
    ...(module.manualPaths ?? []).map(
      (p) => `- \`${p}\` (delete **by hand** — see the note under section 2)`,
    ),
  ].join('\n');
  const proof = module.frontendFenced
    ? `\`scripts/subtraction-test.mjs --module ${module.id}\` proves this whole recipe nightly, in
an isolated worktree — API, both frontends and \`packages/shared\`.`
    : `\`scripts/subtraction-test.mjs --module ${module.id}\` proves the \`apps/api\` half of this
recipe nightly, in an isolated worktree. It deletes the frontend and
\`packages/shared\` paths in section 1 too, but it cannot yet *verify* them, because
the cross-references under "not yet fence-marked" above have no fence markers to
strip — so run the last two commands yourself after following section 2.`;

  return `# Removing \`${module.id}\`

${module.summary}

Generated by \`scripts/subtraction-test.mjs --emit-docs\` — do not hand-edit; re-run
the generator instead. Sections 1, 3, 4 and 5 come from the module's entry in that
script; section 2 is read out of the \`// <module:${module.id}>\` fence markers in the
codebase.

## 1. Delete

${pathsSection}

## 2. Strip cross-module references

### Fence-marked (mechanical)

Every line/block below carries a \`// <module:${module.id}>\` (or
\`// <module:${module.id}>\` ... \`// </module:${module.id}>\`) fence comment — inside JSX the
same markers appear as \`{/* <module:${module.id}> */}\`. Delete the marked lines/blocks
and the markers themselves.

${renderFenceSection(fenceResults)}

### Not yet fence-marked (edit by hand)

These references are **not** fenced, so \`scripts/subtraction-test.mjs\` neither strips
them nor proves they were handled. Any \`packages/shared/src/*\` folder marked "delete by
hand" in section 1 belongs here too: the script leaves it in place because
\`packages/shared/src/index.ts\` re-exports it through unfenced \`export *\` lines, so
deleting the folder on its own would break \`build shared\`. Delete the folder and those
export lines together. Work through the list by hand:

${renderManualStepsSection(module.manualSteps)}

## 3. Drop \`.env\` variables

${renderEnvVarsSection(module.envVars)}

## 4. Database

${renderDatabaseSection(module.id)}

## 5. Verify

\`\`\`
pnpm --dir packages/shared run build
pnpm --dir apps/api exec tsc --noEmit -p tsconfig.build.json
pnpm --dir apps/api run test
pnpm --dir apps/web run build && pnpm --dir apps/web run test
pnpm --dir apps/admin run build && pnpm --dir apps/admin run test
\`\`\`

${proof}
`;
}

function renderReadme() {
  const removableList = MODULES.map((m) => `- [\`${m.id}\`](./${m.id}.md) — ${m.summary}`).join(
    '\n',
  );
  const nonRemovableList = NON_REMOVABLE.map((m) => `- **${m.id}** — ${m.reason}`).join('\n\n');
  const deferredProvidersList = DEFERRED_PROVIDERS.map((p) => `- **${p.id}** — ${p.note}`).join(
    '\n\n',
  );
  const gaps = MODULES.filter((m) => !m.frontendFenced && hasFrontendPaths(m));
  const gapList =
    gaps.length === 0
      ? '_None — every module is fully fence-marked and fully proven._'
      : gaps.map((m) => `- \`${m.id}\``).join('\n');

  return `# Removal recipes

This directory is generated by \`node scripts/subtraction-test.mjs --emit-docs\` from
\`// <module:x>\` fence markers left in the codebase by optional modules' cross-references.
Regenerate it instead of hand-editing after any fence changes.

The same fence markers back \`scripts/subtraction-test.mjs\`, which nightly (and on pushes to
\`staging\`/\`main\`) deletes each module below in an isolated git worktree and proves the rest
of the app still type-checks and passes its unit tests — see
\`.github/workflows/subtraction.yml\`.

## Removable modules

${removableList}

## Coverage: what is proven vs. documented

Each recipe has two kinds of cross-reference. **Fence-marked** ones carry a
\`// <module:x>\` comment, are stripped mechanically by the script, and are therefore
*proven*: the subtracted tree is type-checked and unit-tested. **Not-yet-fence-marked**
ones are listed in each recipe for a human to apply, and are *not* proven.

Every module's \`apps/api\` half is fully fenced and therefore fully proven. The modules
with no frontend or \`packages/shared\` surface at all (\`cloudfront\` and the three
\`oauth-*\` providers) additionally get \`apps/web\` and \`apps/admin\` type-checked and
unit-tested after the subtraction, so they are proven end to end.

The remaining modules do own frontend and shared files. Those files are listed in the
recipes and the script deletes the ones it safely can, but their cross-references are not
fenced, so the frontend result is **not** verified — the runner prints a \`COVERAGE GAP\`
line for each. Modules in that state:

${gapList}

Closing a gap means moving that module's frontend entries out of \`manualSteps\` and into
real fence markers — including the \`{/* <module:x> */}\` form for references that sit
inside JSX — then setting \`frontendFenced: true\` on the module, which switches on
\`tsc --noEmit\` + \`vitest\` for both frontends in the subtracted worktree. The
coupling is not always mechanical: \`NOTIFICATION_TYPE_LABELS\` in both apps is a total
\`Record\` over \`NotificationTypeEnum\`, so removing \`payment\` or \`contact-us\` must drop
enum members and their label entries together; and removing \`statistic\` breaks
\`apps/admin\`'s \`/dashboard\` redirects at runtime without any type error.

## Scope note: v0.1 providers

Only \`cloudfront\` is exercised this round. S3/SQS/SNS/SES(mail)/Lambda are also optional,
disable-fallback providers, but they predate the fence-marker convention introduced in this
PR (Task 14, v0.3). Retrofitting fences onto all of them is deliberately deferred to a
dedicated pass rather than folded into this release. The coupling shape differs per
provider — investigated individually rather than deferred on a blanket excuse:

${deferredProvidersList}

## Not removable (investigated, kept in core)

${nonRemovableList}
`;
}

function emitDocs() {
  for (const module of MODULES) {
    const docPath = path.join(REPO_ROOT, 'docs/removal', `${module.id}.md`);

    writeFileSync(docPath, renderModuleDoc(module));
    log(`wrote docs/removal/${module.id}.md`);
  }

  writeFileSync(path.join(REPO_ROOT, 'docs/removal/README.md'), renderReadme());
  log('wrote docs/removal/README.md');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  assertModulePathsExist(MODULES);

  if (args.emitDocs) {
    emitDocs();

    return;
  }

  const modules = selectModules(args.modules);
  const results = modules.map((module) => runModule(module, args.keepOnFailure));
  const failed = results.filter((result) => !result.pass);

  log('\n=== subtraction test summary ===');

  for (const result of results) {
    log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.id}`);
  }

  if (failed.length > 0) {
    for (const result of failed) {
      if (result.worktree) log(`kept worktree for inspection: ${result.worktree.dir}`);
    }

    process.exitCode = 1;
  }
}

main();
