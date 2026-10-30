UPDATE users
SET role_id = 5,
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(TRIM(email)) = 'ct.lopsan@gmail.com'
  AND role_id <> 5;
