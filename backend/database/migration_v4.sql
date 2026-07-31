-- =============================================================================
-- APTS Bills Tracking System — Migration v4
-- Changes:
-- 1. New `claim.approve` permission — only APTS Manager (and Super Admin as
--    full-access fallback) can approve & complete claims via
--    POST /api/claims/:id/approve. In-between officers NEVER get this.
-- 2. New `claim.pull_back` permission — ONLY the Vendor role gets it.
--    Pull-back is now restricted to the vendor who owns the claim, in BOTH
--    workflow and manual (non-workflow) modes. No officer can pull back.
-- =============================================================================

USE `apts_bills_tracking`;

-- =============================================================================
-- 1. claim.approve → APTS Manager (role id 6) + Super Admin (role id 1)
-- =============================================================================
UPDATE roles
SET permissions = JSON_SET(permissions, '$.claim.approve', true)
WHERE role_name = 'APTS Manager';

UPDATE roles
SET permissions = JSON_SET(permissions, '$.claim.approve', true)
WHERE role_name = 'Super Admin';

-- =============================================================================
-- 2. Vendor (role id 2): claim.pull_back = true (vendor-only pull-back) AND
--    claim.forward = true (needed for non-workflow assign — vendor dispatches the
--    claim to the first officer via POST /api/claims/:id/assign, which is gated
--    on claim.forward). All other roles are left untouched.
-- =============================================================================
UPDATE roles
SET permissions = JSON_SET(JSON_SET(permissions, '$.claim.pull_back', true), '$.claim.forward', true)
WHERE role_name = 'Vendor';

-- =============================================================================
-- Note:
-- This migration is idempotent — JSON_SET only adds/updates the named path.
-- No schema (table) changes are required for this migration.
-- =============================================================================
