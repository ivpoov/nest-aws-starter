-- Revenue = succeeded minus refunded transaction amounts, gap-filled per
-- calendar day (mirrors userRegistrationsByDay.sql's shape). Filtered to a
-- single reporting currency ($2) — this starter assumes one currency in
-- production; a real multi-currency deployment would need per-currency
-- buckets instead of a single amountCents column.
--
-- The bucket total is cast to bigint, never int: SUM() over an int column
-- already returns bigint, and forcing it back into int32 makes Postgres raise
-- `integer out of range` — a hard 500 on the whole statistics endpoint — as
-- soon as any single day crosses 2_147_483_647 cents (~$21.5M). bigint keeps
-- the ceiling at Number.MAX_SAFE_INTEGER cents (~$90T) once the repository
-- narrows it to a JS number for the JSON contract. Same rule as
-- mrrCurrent.sql.
-- @param {Int} $1:days
-- @param {String} $2:currency
SELECT
  series.day::date AS day,
  (
    COALESCE(SUM(CASE WHEN t.status = 'SUCCEEDED' THEN t."amountCents" END), 0)
    - COALESCE(SUM(CASE WHEN t.status = 'REFUNDED' THEN t."amountCents" END), 0)
  )::bigint AS "amountCents"
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
