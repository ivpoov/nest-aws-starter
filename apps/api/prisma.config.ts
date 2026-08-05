import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Only migrate/introspection commands need a real DATABASE_URL; `prisma generate`
    // must keep working without one (fresh clone, CI build) — hence the placeholder.
    url:
      process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
  migrations: {
    // Dev/staging only — CI and the e2e suite never run this (they seed
    // their own data per-test).
    seed: 'tsx prisma/seed.ts',
  },
});
