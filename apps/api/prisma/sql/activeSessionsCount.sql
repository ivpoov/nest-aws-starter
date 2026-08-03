SELECT COUNT(*)::int AS count
FROM sessions
WHERE "activeUntil" > NOW();
