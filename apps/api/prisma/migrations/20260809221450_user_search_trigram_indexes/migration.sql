-- The admin user search matches `displayName` and `auth_methods.email` by
-- substring (`ILIKE '%term%'`). No btree can answer a leading wildcard, so
-- both sides of that search were seq scans: every user row filtered out one
-- by one, and the whole auth_methods table materialized as a subplan, on
-- every keystroke. Trigram GIN indexes make both sides index scans.
--
-- Why trigram rather than restricting the search to prefixes: prefix matching
-- would cost an admin the ability to find a user by "@company.com" or by a
-- surname, which is most of what the box is for, and it is not free either
-- (it needs its own lower(col) text_pattern_ops expression indexes). Trigram
-- indexes are paid for in write throughput and index size, and these two
-- tables are the cheapest place in the schema to pay that: a user row is
-- written at registration and on the rare profile edit, an auth_methods row
-- at registration and when a provider is linked. Neither is on a hot write
-- path.
--
-- Requires the pg_trgm extension. It ships with PostgreSQL's contrib modules
-- and is available on RDS/Aurora, Cloud SQL and Azure Database, but CREATE
-- EXTENSION needs an elevated role (rds_superuser on RDS) — if the migration
-- role cannot create it, an operator must run this one statement once by
-- hand before deploying.
--
-- Safe on a populated, live database. CREATE EXTENSION is a catalog insert.
-- The index builds are CONCURRENTLY, so they take SHARE UPDATE EXCLUSIVE
-- rather than the SHARE lock a plain CREATE INDEX holds for its whole build:
-- registrations, logins and profile edits keep working while they run. They
-- cannot be wrapped in a transaction, which Prisma does not do here (verified
-- against a scratch database); the trade is that a failed build leaves an
-- INVALID index to drop and re-run, hence IF NOT EXISTS.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "auth_methods_email_trgm_idx" ON "auth_methods" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_displayName_trgm_idx" ON "users" USING GIN ("displayName" gin_trgm_ops);
