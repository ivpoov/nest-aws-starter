-- Revenue = succeeded minus refunded transaction amounts, gap-filled per
-- calendar day (mirrors userRegistrationsByDay.sql's shape). Filtered to a
-- single reporting currency ($2) — this starter assumes one currency in
-- production; a real multi-currency deployment would need per-currency
-- buckets instead of a single amountCents column.
-- @param {Int} $1:days
-- @param {String} $2:currency
SELECT
  series.day::date AS day,
  (
    COALESCE(SUM(CASE WHEN t.status = 'SUCCEEDED' THEN t."amountCents" END), 0)
    - COALESCE(SUM(CASE WHEN t.status = 'REFUNDED' THEN t."amountCents" END), 0)
  )::int AS "amountCents"
FROM generate_series(
  (CURRENT_DATE - ($1::int - 1))::timestamp,
  CURRENT_DATE::timestamp,
  INTERVAL '1 day'
) AS series(day)
LEFT JOIN payment_transactions t
  ON t."createdAt" >= series.day AND t."createdAt" < series.day + INTERVAL '1 day'
  AND t.status IN ('SUCCEEDED', 'REFUNDED')
  AND t.currency = $2
GROUP BY series.day
ORDER BY series.day;
