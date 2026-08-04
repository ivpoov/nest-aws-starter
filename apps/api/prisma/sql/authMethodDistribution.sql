SELECT
  type::text AS type,
  COUNT(*)::int AS count
FROM auth_methods
GROUP BY type
ORDER BY type;
