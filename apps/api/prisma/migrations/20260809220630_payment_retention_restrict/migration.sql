-- Financial records must outlive the account they belong to: ON DELETE
-- CASCADE meant deleting one user row silently destroyed that user's whole
-- payment audit trail. Both foreign keys become RESTRICT.
--
-- Safe on a populated, live database. Prisma applies migration statements
-- outside a wrapping transaction, so every lock below is released as soon as
-- its own statement commits, and none of them scans a table:
--   * DROP CONSTRAINT is a catalog update — ACCESS EXCLUSIVE on the child
--     table for microseconds, no scan.
--   * ADD CONSTRAINT ... NOT VALID likewise takes no data pass; the usual
--     cost of adding a foreign key (a full seq scan of the child table while
--     holding ACCESS EXCLUSIVE) is exactly what NOT VALID skips. The
--     constraint is enforced on every new and updated row from this point.
--   * VALIDATE CONSTRAINT does the one-off backfill check, and it takes only
--     SHARE UPDATE EXCLUSIVE on the child plus ROW SHARE on users — reads and
--     writes keep running against both tables throughout.
-- The rows are known-good regardless: the same foreign key already existed
-- with the same columns, and only its ON DELETE action changes here.

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- DropForeignKey
ALTER TABLE "payment_transactions" DROP CONSTRAINT "payment_transactions_userId_fkey";

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- ValidateForeignKey
ALTER TABLE "subscriptions" VALIDATE CONSTRAINT "subscriptions_userId_fkey";

-- ValidateForeignKey
ALTER TABLE "payment_transactions" VALIDATE CONSTRAINT "payment_transactions_userId_fkey";
