-- Revenue-by-plan breakdown for the trailing $1 days: succeeded minus
-- refunded transaction amounts, grouped by the plan the transaction's
-- subscription belongs to. Same single-currency ($2) assumption as
-- revenueByDay.sql. Bucket totals are bigint for the same int32-overflow
-- reason spelled out there.
--
-- LEFT JOIN, not INNER, and the same day window as revenueByDay.sql, because
-- these two figures are rendered on one dashboard and have to add up. A
-- transaction with no subscriptionId still moved real money; inner-joining
-- dropped it from the breakdown while totals.revenueCents (summed from
-- revenueByDay.sql) still counted it, so an admin saw two revenue numbers
-- that disagreed with nothing on screen explaining the gap. The total is the
-- honest figure — it is the sum of the charges that actually settled — so the
-- breakdown was the wrong one, and the unattributed remainder now gets its
-- own row with a null planId instead of vanishing. SUM("amountCents") over
-- every row here equals the sum of revenueByDay.sql's buckets by
-- construction.
-- @param {Int} $1:days
-- @param {String} $2:currency
SELECT
  p.id AS "planId",
  p.name AS "planName",
  (
    COALESCE(SUM(CASE WHEN t.status = 'SUCCEEDED' THEN t."amountCents" END), 0)
    - COALESCE(SUM(CASE WHEN t.status = 'REFUNDED' THEN t."amountCents" END), 0)
  )::bigint AS "amountCents"
FROM payment_transactions t
LEFT JOIN subscriptions s ON s.id = t."subscriptionId"
LEFT JOIN plans p ON p.id = s."planId"
WHERE t."createdAt" >= (CURRENT_DATE - ($1::int - 1))::timestamp
  AND t.status IN ('SUCCEEDED', 'REFUNDED')
  AND t.currency = $2
GROUP BY p.id, p.name
ORDER BY "amountCents" DESC;
