SELECT
  status::text AS status,
  COUNT(*)::int AS count
FROM users
GROUP BY status
ORDER BY status;
