-- @param {Int} $1:days
SELECT
  series.day::date AS day,
  COUNT(a.id)::int AS count
FROM generate_series(
  (CURRENT_DATE - ($1::int - 1))::timestamp,
  CURRENT_DATE::timestamp,
  INTERVAL '1 day'
) AS series(day)
LEFT JOIN activities a
  ON a."createdAt" >= series.day AND a."createdAt" < series.day + INTERVAL '1 day'
  AND a.type = 'AUTH_NEW_DEVICE'
GROUP BY series.day
ORDER BY series.day;
