-- =====================================================================
-- Run before a real launch. Deletes the four demo accounts (and their profiles).
-- The demo coordinator can see everything, so it must not exist next to real data.
-- Also run 04_drop_demo_read_policies.sql.
-- =====================================================================
delete from auth.users where email like '%.demo@barakat.test';
