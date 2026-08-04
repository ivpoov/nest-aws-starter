-- Revenue-by-plan breakdown for the trailing $1 days: succeeded minus
-- refunded transaction amounts, grouped by the plan the transaction's
-- subscription belongs to (joined through subscriptions, per this starter's
-- subscription-only payment model — a transaction with no subscription has
-- no plan to attribute to and is excluded). Same single-currency ($2)
-- assumption as revenueByDay.sql.
-- @param {Int} $1:days
-- @param {String} $2:currency
SELECT
  p.id AS "planId",
  p.name AS "planName",
  (
    COALESCE(SUM(CASE WHEN t.status = 'SUCCEEDED' THEN t."amountCents" END), 0)
    - COALESCE(SUM(CASE WHEN t.status = 'REFUNDED' THEN t."amountCents" END), 0)
  )::int AS "amountCents"
FROM payment_transactions t
JOIN subscriptions s ON s.id = t."subscriptionId"
JOIN plans p ON p.id = s."planId"
WHERE t."createdAt" >= NOW() - ($1::int || ' days')::interval
  AND t.status IN ('SUCCEEDED', 'REFUNDED')
  AND t.currency = $2
GROUP BY p.id, p.name
ORDER BY "amountCents" DESC;
