-- Two unindexed foreign keys (subscriptions.planId, payment_transactions
-- .subscriptionId) and two admin list filters with no index able to serve
-- their ordering (activities by date range, payment_transactions by status).
--
-- Safe on a populated, live database. CONCURRENTLY is the whole point: a
-- plain CREATE INDEX holds a SHARE lock for the entire build, which blocks
-- every INSERT, UPDATE and DELETE on the table until it finishes — on
-- activities, the fastest-growing table here, that is a write outage
-- proportional to table size. CONCURRENTLY builds in two passes under
-- SHARE UPDATE EXCLUSIVE instead, so writes keep flowing throughout; it is
-- slower and needs two table scans, which is the correct trade.
--
-- CONCURRENTLY cannot run inside a transaction block. That is fine here:
-- Prisma applies these statements without wrapping them in one (verified
-- against a scratch database before this migration was written). The cost is
-- that a failed build leaves an INVALID index behind rather than rolling
-- back — drop it and re-run, which is why each statement is IF NOT EXISTS.

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "activities_createdAt_id_idx" ON "activities"("createdAt", "id");

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payment_transactions_status_id_idx" ON "payment_transactions"("status", "id");

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payment_transactions_subscriptionId_idx" ON "payment_transactions"("subscriptionId");

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "subscriptions_planId_idx" ON "subscriptions"("planId");
