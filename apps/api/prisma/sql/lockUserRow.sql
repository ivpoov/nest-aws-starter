-- Row-level write lock on one user, taken inside a transaction so every
-- concurrent auth-method change for that account serializes behind it. The
-- returned column is irrelevant; the lock is the point.
SELECT id
FROM users
WHERE id = $1
FOR UPDATE;
