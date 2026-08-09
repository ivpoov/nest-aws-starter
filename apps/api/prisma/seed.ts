// Dev/staging demo data — never auto-run by CI or the e2e suite (those seed
// their own data per-test). Invoke manually:
//   pnpm --dir apps/api exec prisma db seed
// or directly:
//   pnpm --dir apps/api exec tsx prisma/seed.ts   (DATABASE_URL set)
//
// Goal: a fresh clone that follows the quick start opens an application with
// content on every page — an admin, three users in three different states,
// plans, subscriptions with transactions, notes, contact messages, an
// activity trail and notifications. Credentials are printed at the end.
//
// Idempotent by construction: every row is addressed by a deterministic
// UUIDv7-shaped id and written with `upsert`, so a second run updates the
// demo data in place instead of duplicating it. Timestamps are relative to
// "now", which keeps the trailing-30-day dashboard charts populated however
// long after the clone the script is run.
//
// Over the 300-line file budget on purpose: `scripts/subtraction-test.mjs`
// scans exactly one seed file (`apps/api/prisma/seed.ts`) for `// <module:x>`
// fences, so splitting this into helper files would leave an optional
// module's rows unfenced and break a subtracted clone's seed.
//
// Plain relative imports only (no path aliases, no NestJS DI) — run via tsx
// (esbuild-backed), not Node's native TS support: the generated Prisma
// client's internal imports are NodeNext-style (`./enums.js` pointing at
// `./enums.ts`), which only esbuild/tsc-style resolvers rewrite — Node's
// loader resolves module specifiers literally and cannot follow them.
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { ActivityType } from '../src/generated/prisma/enums.js';
import { ARGON2_OPTIONS } from '../src/modules/auth/constants/auth.constants.js';

// The demo accounts below carry passwords this repository documents in
// public. Seeding a production database with them hands an admin account to
// anyone who read the README, so refuse before the client is even
// constructed: no connection, no writes, no half-seeded state.
if (process.env.NODE_ENV === 'production') {
  console.error(
    'Refusing to seed: NODE_ENV=production. This script creates demo accounts with publicly documented passwords.',
  );
  process.exit(1);
}

const connectionString: string | undefined = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DAY_MS: number = 86_400_000;
const NOW_MS: number = Date.now();

function daysAgo(days: number): Date {
  return new Date(NOW_MS - days * DAY_MS);
}

function daysAhead(days: number): Date {
  return new Date(NOW_MS + days * DAY_MS);
}

// Deterministic, valid UUIDv7-shaped ids (version 7, variant 10xx) behind a
// fixed timestamp prefix. Ids ascend in the order the rows are dated, so the
// id-ordered cursor pagination the API uses lists demo rows in the same order
// their displayed timestamps suggest.
function demoId(index: number): string {
  return `01980000-0000-7000-8000-${index.toString().padStart(12, '0')}`;
}

const ADMIN_PASSWORD: string = 'DemoAdmin123!';
const USER_PASSWORD: string = 'DemoUser123!';

interface UserSeedInterface {
  readonly id: string;
  readonly authMethodId: string;
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  readonly role: 'ADMIN' | 'USER';
  readonly status: 'ACTIVE' | 'BLOCKED';
  readonly createdDaysAgo: number;
  readonly note: string;
}

const ADMIN: UserSeedInterface = {
  id: demoId(1),
  authMethodId: demoId(801),
  email: 'admin@example.com',
  displayName: 'Ada Admin',
  password: ADMIN_PASSWORD,
  role: 'ADMIN',
  status: 'ACTIVE',
  createdDaysAgo: 26,
  note: 'admin — full access to the admin app',
};

const LINKED_USER: UserSeedInterface = {
  id: demoId(2),
  authMethodId: demoId(802),
  email: 'taylor@example.com',
  displayName: 'Taylor Rivera',
  password: USER_PASSWORD,
  role: 'USER',
  status: 'ACTIVE',
  createdDaysAgo: 19,
  note: 'user — password plus a linked Google identity',
};

const EMAIL_USER: UserSeedInterface = {
  id: demoId(3),
  authMethodId: demoId(803),
  email: 'jordan@example.com',
  displayName: 'Jordan Blake',
  password: USER_PASSWORD,
  role: 'USER',
  status: 'ACTIVE',
  createdDaysAgo: 11,
  note: 'user — email and password only',
};

const BLOCKED_USER: UserSeedInterface = {
  id: demoId(4),
  authMethodId: demoId(804),
  email: 'casey@example.com',
  displayName: 'Casey Morgan',
  password: USER_PASSWORD,
  role: 'USER',
  status: 'BLOCKED',
  createdDaysAgo: 4,
  note: 'user — BLOCKED, login is refused with USER_BLOCKED',
};

const USERS: readonly UserSeedInterface[] = [ADMIN, LINKED_USER, EMAIL_USER, BLOCKED_USER];

async function seedUsers(): Promise<void> {
  for (const seed of USERS) {
    const createdAt: Date = daysAgo(seed.createdDaysAgo);
    const passwordHash: string = await hash(seed.password, ARGON2_OPTIONS);
    const displayName: string = seed.displayName;

    await prisma.user.upsert({
      where: { id: seed.id },
      update: { role: seed.role, status: seed.status, displayName, createdAt },
      create: { id: seed.id, role: seed.role, status: seed.status, displayName, createdAt },
    });

    await prisma.authMethod.upsert({
      where: { id: seed.authMethodId },
      update: { passwordHash, isEmailVerified: true, lastUsedAt: daysAgo(1) },
      create: {
        id: seed.authMethodId,
        userId: seed.id,
        type: 'EMAIL',
        email: seed.email,
        isEmailVerified: true,
        passwordHash,
        createdAt,
        lastUsedAt: daysAgo(1),
      },
    });
  }

  // A second identity on one account: what makes the profile page's linked
  // methods and the dashboard's auth-method breakdown show a real mix. The
  // AuthMethodType enum is core schema, so this row outlives the removal of
  // any individual oauth-* provider module.
  await prisma.authMethod.upsert({
    where: { id: demoId(805) },
    update: { lastUsedAt: daysAgo(2) },
    create: {
      id: demoId(805),
      userId: LINKED_USER.id,
      type: 'GOOGLE',
      email: LINKED_USER.email,
      isEmailVerified: true,
      providerAccountId: 'demo-google-account-102938475',
      createdAt: daysAgo(18),
      lastUsedAt: daysAgo(2),
    },
  });

  console.log(`Seeded ${USERS.length} users (1 admin, 2 active, 1 blocked) and 5 auth methods`);
}

interface SessionSeedInterface {
  readonly id: string;
  readonly userId: string;
  readonly device: string;
  readonly ip: string;
  readonly lastActiveDaysAgo: number;
}

// Session rows are metadata only — no token material ever lives in Postgres
// (see the model's own comment) — so these populate the sessions pages and
// the dashboard's active-session tile without minting anything usable.
const SESSIONS: readonly SessionSeedInterface[] = [
  {
    id: demoId(701),
    userId: ADMIN.id,
    device: 'Chrome on macOS',
    ip: '203.0.113.10',
    lastActiveDaysAgo: 0,
  },
  {
    id: demoId(702),
    userId: LINKED_USER.id,
    device: 'Firefox on Fedora',
    ip: '203.0.113.11',
    lastActiveDaysAgo: 1,
  },
  {
    id: demoId(703),
    userId: EMAIL_USER.id,
    device: 'Safari on iOS',
    ip: '203.0.113.12',
    lastActiveDaysAgo: 2,
  },
];

async function seedSessions(): Promise<void> {
  for (const seed of SESSIONS) {
    const lastActiveAt: Date = daysAgo(seed.lastActiveDaysAgo);
    const activeUntil: Date = daysAhead(25);

    await prisma.session.upsert({
      where: { id: seed.id },
      update: { lastActiveAt, activeUntil },
      create: {
        id: seed.id,
        userId: seed.userId,
        device: seed.device,
        ip: seed.ip,
        createdAt: daysAgo(seed.lastActiveDaysAgo + 1),
        lastActiveAt,
        activeUntil,
      },
    });
  }

  console.log(`Seeded ${SESSIONS.length} active sessions`);
}

interface NoteSeedInterface {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly status: 'ACTIVE' | 'ARCHIVED';
  readonly createdDaysAgo: number;
}

const NOTES: readonly NoteSeedInterface[] = [
  {
    id: demoId(101),
    userId: LINKED_USER.id,
    title: 'Welcome to the starter',
    body: 'Notes are the reference module: controller, service, repository contract, CASL rules and tests. Copy this folder when you add your own feature.',
    status: 'ACTIVE',
    createdDaysAgo: 18,
  },
  {
    id: demoId(102),
    userId: LINKED_USER.id,
    title: 'Deployment checklist',
    body: 'Rotate AUTH_JWT_SECRET, point DATABASE_URL at RDS, set CORS_ORIGINS to the real frontend hosts, and turn Swagger off.',
    status: 'ACTIVE',
    createdDaysAgo: 9,
  },
  {
    id: demoId(103),
    userId: LINKED_USER.id,
    title: 'Old meeting notes',
    body: 'Archived notes stay readable but drop out of the default list — the status filter is what brings them back.',
    status: 'ARCHIVED',
    createdDaysAgo: 6,
  },
  {
    id: demoId(104),
    userId: EMAIL_USER.id,
    title: 'Reading list',
    body: 'Cursor pagination, argon2id parameters, and the difference between a liveness probe and a readiness probe.',
    status: 'ACTIVE',
    createdDaysAgo: 5,
  },
  {
    id: demoId(105),
    userId: EMAIL_USER.id,
    title: 'Ideas for the API',
    body: 'Every note belongs to its author: another user asking for this id gets a 403, not a 404.',
    status: 'ACTIVE',
    createdDaysAgo: 2,
  },
];

async function seedNotes(): Promise<void> {
  for (const seed of NOTES) {
    const createdAt: Date = daysAgo(seed.createdDaysAgo);

    await prisma.note.upsert({
      where: { id: seed.id },
      update: { title: seed.title, body: seed.body, status: seed.status, createdAt },
      create: {
        id: seed.id,
        userId: seed.userId,
        title: seed.title,
        body: seed.body,
        status: seed.status,
        createdAt,
      },
    });
  }

  console.log(`Seeded ${NOTES.length} notes`);
}

// <module:contact-us>
interface ContactMessageSeedInterface {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly body: string;
  readonly status: 'OPEN' | 'RESOLVED';
  readonly createdDaysAgo: number;
}

const CONTACT_MESSAGES: readonly ContactMessageSeedInterface[] = [
  {
    id: demoId(201),
    name: 'Robin Fields',
    email: 'robin.fields@example.com',
    subject: 'Question about the yearly plan',
    body: 'Does the yearly plan include the same limits as the monthly one, or are they billed differently?',
    status: 'RESOLVED',
    createdDaysAgo: 8,
  },
  {
    id: demoId(202),
    name: 'Sam Okafor',
    email: 'sam.okafor@example.com',
    subject: 'Bug report: export button',
    body: 'The export button on the notes page does nothing in Firefox. It works in Chrome.',
    status: 'OPEN',
    createdDaysAgo: 3,
  },
  {
    id: demoId(203),
    name: 'Lena Fischer',
    email: 'lena.fischer@example.com',
    subject: 'Partnership enquiry',
    body: 'We would like to talk about integrating your API into our onboarding flow. Who should we contact?',
    status: 'OPEN',
    createdDaysAgo: 1,
  },
];

async function seedContactMessages(): Promise<void> {
  for (const seed of CONTACT_MESSAGES) {
    const createdAt: Date = daysAgo(seed.createdDaysAgo);

    await prisma.contactMessage.upsert({
      where: { id: seed.id },
      update: { status: seed.status, createdAt },
      create: {
        id: seed.id,
        name: seed.name,
        email: seed.email,
        subject: seed.subject,
        body: seed.body,
        status: seed.status,
        createdAt,
      },
    });
  }

  console.log(`Seeded ${CONTACT_MESSAGES.length} contact messages`);
}
// </module:contact-us>

// <module:payment>
interface PlanSeedInterface {
  readonly name: string;
  readonly description: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly intervalDays: number;
}

const PLANS: readonly PlanSeedInterface[] = [
  {
    name: 'Starter Monthly',
    description: 'Monthly access to the starter tier',
    amountCents: 999,
    currency: 'USD',
    intervalDays: 30,
  },
  {
    name: 'Starter Yearly',
    description: 'Yearly access to the starter tier — two months free',
    amountCents: 9990,
    currency: 'USD',
    intervalDays: 365,
  },
];

// Idempotent by name: `Plan.name` has no unique DB constraint (admin CRUD
// allows duplicate names), so this upserts by lookup rather than
// `prisma.plan.upsert()` (which requires a unique `where`).
async function seedPlan(seed: PlanSeedInterface): Promise<string> {
  const existing: { id: string } | null = await prisma.plan.findFirst({
    where: { name: seed.name },
    select: { id: true },
  });

  if (existing) {
    await prisma.plan.update({ where: { id: existing.id }, data: { ...seed } });

    return existing.id;
  }

  const created: { id: string } = await prisma.plan.create({
    data: { ...seed, providerRefs: {} },
    select: { id: true },
  });

  return created.id;
}

interface SubscriptionSeedInterface {
  readonly id: string;
  readonly userId: string;
  readonly planName: string;
  readonly providerRef: string;
  readonly startedDaysAgo: number;
  readonly endsInDays: number;
}

// Two live subscriptions, one per plan, so the dashboard's MRR tile and the
// revenue-by-plan breakdown both have more than one slice to draw.
const SUBSCRIPTIONS: readonly SubscriptionSeedInterface[] = [
  {
    id: demoId(301),
    userId: LINKED_USER.id,
    planName: 'Starter Monthly',
    providerRef: 'sub_demo_00000001',
    startedDaysAgo: 19,
    endsInDays: 11,
  },
  {
    id: demoId(302),
    userId: EMAIL_USER.id,
    planName: 'Starter Yearly',
    providerRef: 'sub_demo_00000002',
    startedDaysAgo: 11,
    endsInDays: 354,
  },
];

interface TransactionSeedInterface {
  readonly id: string;
  readonly subscriptionId: string;
  readonly userId: string;
  readonly status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  readonly amountCents: number;
  readonly providerRef: string;
  readonly createdDaysAgo: number;
}

// One row per status a reader will meet in production, so the admin
// transactions table's filters all return something.
const TRANSACTIONS: readonly TransactionSeedInterface[] = [
  {
    id: demoId(401),
    subscriptionId: demoId(301),
    userId: LINKED_USER.id,
    status: 'SUCCEEDED',
    amountCents: 999,
    providerRef: 'pi_demo_00000001',
    createdDaysAgo: 19,
  },
  {
    id: demoId(402),
    subscriptionId: demoId(302),
    userId: EMAIL_USER.id,
    status: 'SUCCEEDED',
    amountCents: 9990,
    providerRef: 'pi_demo_00000002',
    createdDaysAgo: 11,
  },
  {
    id: demoId(403),
    subscriptionId: demoId(301),
    userId: LINKED_USER.id,
    status: 'FAILED',
    amountCents: 999,
    providerRef: 'pi_demo_00000003',
    createdDaysAgo: 5,
  },
  {
    id: demoId(404),
    subscriptionId: demoId(301),
    userId: LINKED_USER.id,
    status: 'SUCCEEDED',
    amountCents: 999,
    providerRef: 'pi_demo_00000004',
    createdDaysAgo: 4,
  },
  {
    id: demoId(405),
    subscriptionId: demoId(301),
    userId: LINKED_USER.id,
    status: 'REFUNDED',
    amountCents: 999,
    providerRef: 'pi_demo_00000005',
    createdDaysAgo: 2,
  },
];

async function seedBilling(): Promise<void> {
  const planIdsByName: Map<string, string> = new Map<string, string>();

  for (const plan of PLANS) {
    planIdsByName.set(plan.name, await seedPlan(plan));
  }

  for (const seed of SUBSCRIPTIONS) {
    const planId: string = planIdsByName.get(seed.planName) ?? '';
    const currentPeriodEndsAt: Date = daysAhead(seed.endsInDays);

    await prisma.subscription.upsert({
      where: { id: seed.id },
      update: { planId, status: 'ACTIVE', currentPeriodEndsAt },
      create: {
        id: seed.id,
        userId: seed.userId,
        planId,
        status: 'ACTIVE',
        provider: 'STRIPE',
        providerRef: seed.providerRef,
        providerCustomerRef: seed.providerRef.replace('sub_', 'cus_'),
        currentPeriodEndsAt,
        createdAt: daysAgo(seed.startedDaysAgo),
      },
    });
  }

  for (const seed of TRANSACTIONS) {
    const createdAt: Date = daysAgo(seed.createdDaysAgo);

    await prisma.paymentTransaction.upsert({
      where: { id: seed.id },
      update: { status: seed.status, createdAt },
      create: {
        id: seed.id,
        userId: seed.userId,
        subscriptionId: seed.subscriptionId,
        status: seed.status,
        amountCents: seed.amountCents,
        currency: 'USD',
        provider: 'STRIPE',
        providerRef: seed.providerRef,
        createdAt,
      },
    });
  }

  console.log(
    `Seeded ${PLANS.length} plans, ${SUBSCRIPTIONS.length} subscriptions, ${TRANSACTIONS.length} transactions`,
  );
}
// </module:payment>

interface ActivitySeedInterface {
  readonly id: string;
  readonly type: ActivityType;
  readonly userId: string | null;
  readonly actorId: string | null;
  readonly meta: Record<string, string>;
  readonly createdDaysAgo: number;
}

const REGISTRATIONS: readonly ActivitySeedInterface[] = USERS.map(
  (user: UserSeedInterface, index: number): ActivitySeedInterface => ({
    id: demoId(501 + index),
    type: 'USER_REGISTERED',
    userId: user.id,
    actorId: user.id,
    meta: { email: user.email },
    createdDaysAgo: user.createdDaysAgo,
  }),
);

const ACTIVITIES: readonly ActivitySeedInterface[] = [
  ...REGISTRATIONS,
  {
    id: demoId(510),
    type: 'AUTH_LOGIN',
    userId: LINKED_USER.id,
    actorId: LINKED_USER.id,
    meta: { email: LINKED_USER.email },
    createdDaysAgo: 12,
  },
  {
    id: demoId(511),
    type: 'AUTH_NEW_DEVICE',
    userId: LINKED_USER.id,
    actorId: LINKED_USER.id,
    meta: { device: 'Firefox on Fedora' },
    createdDaysAgo: 12,
  },
  {
    id: demoId(512),
    type: 'AUTH_METHOD_LINKED',
    userId: LINKED_USER.id,
    actorId: LINKED_USER.id,
    meta: { type: 'GOOGLE' },
    createdDaysAgo: 10,
  },
  {
    id: demoId(513),
    type: 'AUTH_LOGIN_FAILED',
    userId: null,
    actorId: null,
    meta: { email: BLOCKED_USER.email },
    createdDaysAgo: 6,
  },
  {
    id: demoId(514),
    type: 'AUTH_SUSPICIOUS_LOGIN',
    userId: BLOCKED_USER.id,
    actorId: null,
    meta: { scope: 'EMAIL', value: BLOCKED_USER.email },
    createdDaysAgo: 5,
  },
  {
    id: demoId(515),
    type: 'USER_BLOCKED',
    userId: BLOCKED_USER.id,
    actorId: ADMIN.id,
    meta: { reason: 'Repeated failed logins from unrecognized devices' },
    createdDaysAgo: 4,
  },
  {
    id: demoId(516),
    type: 'AUTH_PASSWORD_CHANGED',
    userId: EMAIL_USER.id,
    actorId: EMAIL_USER.id,
    meta: {},
    createdDaysAgo: 3,
  },
  {
    id: demoId(517),
    type: 'AUTH_NEW_DEVICE',
    userId: EMAIL_USER.id,
    actorId: EMAIL_USER.id,
    meta: { device: 'Safari on iOS' },
    createdDaysAgo: 2,
  },
  {
    id: demoId(518),
    type: 'AUTH_LOGIN',
    userId: ADMIN.id,
    actorId: ADMIN.id,
    meta: { email: ADMIN.email },
    createdDaysAgo: 1,
  },
  // <module:payment>
  {
    id: demoId(520),
    type: 'SUBSCRIPTION_ACTIVATED',
    userId: LINKED_USER.id,
    actorId: LINKED_USER.id,
    meta: { provider: 'STRIPE' },
    createdDaysAgo: 19,
  },
  {
    id: demoId(521),
    type: 'SUBSCRIPTION_ACTIVATED',
    userId: EMAIL_USER.id,
    actorId: EMAIL_USER.id,
    meta: { provider: 'STRIPE' },
    createdDaysAgo: 11,
  },
  // </module:payment>
  // <module:contact-us>
  {
    id: demoId(530),
    type: 'CONTACT_RECEIVED',
    userId: null,
    actorId: null,
    meta: { subject: 'Bug report: export button' },
    createdDaysAgo: 3,
  },
  {
    id: demoId(531),
    type: 'CONTACT_RECEIVED',
    userId: null,
    actorId: null,
    meta: { subject: 'Partnership enquiry' },
    createdDaysAgo: 1,
  },
  // </module:contact-us>
];

async function seedActivities(): Promise<void> {
  for (const seed of ACTIVITIES) {
    const createdAt: Date = daysAgo(seed.createdDaysAgo);

    await prisma.activity.upsert({
      where: { id: seed.id },
      update: { createdAt },
      create: {
        id: seed.id,
        type: seed.type,
        userId: seed.userId,
        actorId: seed.actorId,
        meta: seed.meta,
        ip: '203.0.113.10',
        createdAt,
      },
    });
  }

  console.log(`Seeded ${ACTIVITIES.length} activity records`);
}

// <module:notification>
interface NotificationSeedInterface {
  readonly id: string;
  readonly audience: 'USER' | 'ADMIN';
  readonly userId: string | null;
  readonly receiptId: string | null;
  readonly readDaysAgo: number | null;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly meta: Record<string, string>;
  readonly createdDaysAgo: number;
}

// Titles, bodies and meta mirror the dispatcher's builders (see
// modules/notification/builders) so seeded rows are indistinguishable from
// dispatched ones. USER rows carry the eager reader receipt the repository
// writes; ADMIN rows carry none — their receipts are created lazily on read,
// which is what leaves the admin bell with an unread count on first login.
const NOTIFICATIONS: readonly NotificationSeedInterface[] = [
  {
    id: demoId(603),
    audience: 'USER',
    userId: LINKED_USER.id,
    receiptId: demoId(903),
    readDaysAgo: 11,
    type: 'NEW_DEVICE_LOGIN',
    title: 'New device sign-in',
    body: 'Your account was signed in to from a new device: Firefox on Fedora.',
    meta: { device: 'Firefox on Fedora' },
    createdDaysAgo: 12,
  },
  {
    id: demoId(604),
    audience: 'USER',
    userId: EMAIL_USER.id,
    receiptId: demoId(904),
    readDaysAgo: null,
    type: 'PASSWORD_CHANGED',
    title: 'Password changed',
    body: 'Your password was changed. If this was not you, reset it immediately.',
    meta: {},
    createdDaysAgo: 3,
  },
  {
    id: demoId(605),
    audience: 'ADMIN',
    userId: null,
    receiptId: null,
    readDaysAgo: null,
    type: 'USER_BLOCKED',
    title: 'User blocked',
    body: 'A user was blocked: Repeated failed logins from unrecognized devices',
    meta: { userId: BLOCKED_USER.id, actorId: ADMIN.id },
    createdDaysAgo: 4,
  },
  {
    id: demoId(607),
    audience: 'ADMIN',
    userId: null,
    receiptId: null,
    readDaysAgo: null,
    type: 'SUSPICIOUS_LOGIN',
    title: 'Suspicious login activity',
    body: 'Repeated failed logins tripped the lockout for one email address.',
    meta: { scope: 'EMAIL', value: BLOCKED_USER.email },
    createdDaysAgo: 5,
  },
  // <module:payment>
  {
    id: demoId(601),
    audience: 'USER',
    userId: LINKED_USER.id,
    receiptId: demoId(901),
    readDaysAgo: 18,
    type: 'SUBSCRIPTION_ACTIVATED',
    title: 'Subscription activated',
    body: 'Your subscription is now active.',
    meta: { subscriptionId: demoId(301) },
    createdDaysAgo: 19,
  },
  {
    id: demoId(602),
    audience: 'USER',
    userId: EMAIL_USER.id,
    receiptId: demoId(902),
    readDaysAgo: null,
    type: 'SUBSCRIPTION_ACTIVATED',
    title: 'Subscription activated',
    body: 'Your subscription is now active.',
    meta: { subscriptionId: demoId(302) },
    createdDaysAgo: 11,
  },
  // </module:payment>
  // <module:contact-us>
  {
    id: demoId(606),
    audience: 'ADMIN',
    userId: null,
    receiptId: null,
    readDaysAgo: null,
    type: 'CONTACT_MESSAGE',
    title: 'New contact message',
    body: 'A new contact message was received.',
    meta: { contactMessageId: demoId(203), ip: '203.0.113.44' },
    createdDaysAgo: 1,
  },
  // </module:contact-us>
];

async function seedNotifications(): Promise<void> {
  for (const seed of NOTIFICATIONS) {
    const createdAt: Date = daysAgo(seed.createdDaysAgo);

    await prisma.notification.upsert({
      where: { id: seed.id },
      update: { createdAt },
      create: {
        id: seed.id,
        audience: seed.audience,
        userId: seed.userId,
        type: seed.type,
        title: seed.title,
        body: seed.body,
        meta: seed.meta,
        createdAt,
      },
    });

    if (!seed.receiptId || !seed.userId) continue;

    const readAt: Date | null = seed.readDaysAgo === null ? null : daysAgo(seed.readDaysAgo);

    await prisma.notificationReceipt.upsert({
      where: { id: seed.receiptId },
      update: { readAt },
      create: { id: seed.receiptId, notificationId: seed.id, userId: seed.userId, readAt },
    });
  }

  console.log(`Seeded ${NOTIFICATIONS.length} notifications`);
}
// </module:notification>

function printCredentials(): void {
  const separator: string = '─'.repeat(78);

  console.log(`\n${separator}`);
  console.log(' Demo accounts — development only. Never seed a real database.');
  console.log(separator);

  for (const seed of USERS) {
    console.log(` ${seed.email.padEnd(22)} ${seed.password.padEnd(15)} ${seed.note}`);
  }

  console.log(separator);
  console.log(' Web app http://localhost:5173     Admin app http://localhost:5174\n');
}

async function main(): Promise<void> {
  await seedUsers();
  await seedSessions();
  await seedNotes();
  // <module:contact-us>
  await seedContactMessages();
  // </module:contact-us>
  // <module:payment>
  await seedBilling();
  // </module:payment>
  await seedActivities();
  // <module:notification>
  await seedNotifications();
  // </module:notification>
  printCredentials();
}

main()
  .catch((error: unknown): void => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async (): Promise<void> => {
    await prisma.$disconnect();
  });
