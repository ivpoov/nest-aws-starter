-- @param {Int} $1:days
SELECT
  series.day::date AS day,
  COUNT(u.id)::int AS count
FROM generate_series(
  (CURRENT_DATE - ($1::int - 1))::timestamp,
  CURRENT_DATE::timestamp,
  INTERVAL '1 day'
) AS series(day)
LEFT JOIN users u
  ON u."createdAt" >= series.day AND u."createdAt" < series.day + INTERVAL '1 day'
GROUP BY series.day
ORDER BY series.day;
