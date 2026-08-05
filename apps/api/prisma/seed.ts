// Dev/staging seed data — never auto-run by CI or the e2e suite (those seed
// their own data per-test). Invoke manually:
//   pnpm --dir apps/api exec prisma db seed
// or directly:
//   pnpm --dir apps/api exec tsx prisma/seed.ts   (DATABASE_URL set)
//
// Plain relative imports only (no path aliases, no NestJS DI) — run via tsx
// (esbuild-backed), not Node's native TS support: the generated Prisma
// client's internal imports are NodeNext-style (`./enums.js` pointing at
// `./enums.ts`), which only esbuild/tsc-style resolvers rewrite — Node's
// loader resolves module specifiers literally and cannot follow them.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

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
// </module:payment>

const connectionString: string | undefined = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// <module:payment>
// Idempotent by name: `Plan.name` has no unique DB constraint (admin CRUD
// allows duplicate names), so this upserts by lookup rather than
// `prisma.plan.upsert()` (which requires a unique `where`).
async function seedPlan(seed: PlanSeedInterface): Promise<void> {
  const existing = await prisma.plan.findFirst({ where: { name: seed.name } });

  if (existing) {
    await prisma.plan.update({ where: { id: existing.id }, data: { ...seed } });
    console.log(`Updated plan: ${seed.name}`);
    return;
  }

  await prisma.plan.create({ data: { ...seed, providerRefs: {} } });
  console.log(`Created plan: ${seed.name}`);
}
// </module:payment>

// Add non-payment seed data here as the starter grows — this entrypoint
// (`pnpm --dir apps/api run db:seed`) stays wired regardless of which
// optional modules are present; it's just empty in a payment-less clone.
async function main(): Promise<void> {
  // <module:payment>
  for (const plan of PLANS) {
    await seedPlan(plan);
  }
  // </module:payment>
}

main()
  .catch((error: unknown): void => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async (): Promise<void> => {
    await prisma.$disconnect();
  });
