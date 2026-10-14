-- =============================================================================
-- Migration v9: Managing Director (MD) role — read-only analytics dashboard
--   * rank 90 sits between Super Admin (100) and Admin (80), so only a
--     Super Admin can create / manage MD users.
--   * Safe to run more than once (skips if an active "MD" role exists).
-- =============================================================================
USE `apts_bills_tracking`;

INSERT INTO roles (role_name, description, role_rank, permissions, is_active)
SELECT 'MD',
       'Managing Director -- read-only analytics dashboard',
       90,
       '{"report":{"view":true,"export":false},"audit":{"view":false}}',
       1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE role_name = 'MD' AND deleted_at IS NULL
);