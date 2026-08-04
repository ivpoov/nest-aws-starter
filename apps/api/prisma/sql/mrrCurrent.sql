-- MRR = sum over ACTIVE subscriptions of the subscribed plan's amount,
-- normalized to a 30-day month (amountCents * 30.0 / intervalDays) so a
-- yearly plan (intervalDays=365) contributes 30/365 of its price and a
-- monthly plan (intervalDays=30) contributes its full price. Rounded to the
-- nearest cent at the SQL level, then cast to bigint — money stays integer
-- end-to-end, never a float in application code. Filtered to a single
-- reporting currency ($1), same assumption as revenueByDay.sql.
-- @param {String} $1:currency
SELECT
  COALESCE(ROUND(SUM(p."amountCents" * 30.0 / p."intervalDays")::numeric), 0)::bigint AS "mrrCents"
FROM subscriptions s
JOIN plans p ON p.id = s."planId"
WHERE s.status = 'ACTIVE'
  AND p.currency = $1;
