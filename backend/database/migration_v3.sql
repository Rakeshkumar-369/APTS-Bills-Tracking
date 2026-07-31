-- =============================================================================
-- APTS Bills Tracking System — Migration v3
-- Changes:
-- 1. Added `deleted_at DATETIME NULL` to all soft-deletable tables
-- 2. Changed UNIQUE constraints from `(field, is_deleted)` to a generated
--    column that is NULL once deleted. This fixes the 409 "already exists"
--    error when a record is deleted, re-created with the same code/email/name,
--    and then deleted again — the old key only allowed ONE soft-deleted row
--    per unique value forever.
-- 3. Backfilled `deleted_at` for existing soft-deleted rows so they immediately
--    free up their unique values for re-creation.
-- =============================================================================

USE `apts_bills_tracking`;

-- =============================================================================
-- 1. ROLES
-- =============================================================================
ALTER TABLE roles
  ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted,
  ADD COLUMN active_role_name VARCHAR(100) GENERATED ALWAYS AS (IF(deleted_at IS NULL, role_name, NULL)) STORED AFTER deleted_at;

-- Free up unique values for previously soft-deleted rows
UPDATE roles SET deleted_at = COALESCE(updated_at, NOW()) WHERE is_deleted = 1;

ALTER TABLE roles
  DROP INDEX uq_role_name_active,
  ADD UNIQUE KEY uq_role_name_active (active_role_name);

-- =============================================================================
-- 2. VENDORS
-- =============================================================================
ALTER TABLE vendors
  ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted,
  ADD COLUMN active_vendor_code VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, vendor_code, NULL)) STORED AFTER deleted_at;

UPDATE vendors SET deleted_at = COALESCE(updated_at, NOW()) WHERE is_deleted = 1;

ALTER TABLE vendors
  DROP INDEX uq_vendor_code_active,
  ADD UNIQUE KEY uq_vendor_code_active (active_vendor_code);

-- =============================================================================
-- 3. USERS
-- =============================================================================
ALTER TABLE users
  ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted,
  ADD COLUMN active_email VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED AFTER deleted_at;

UPDATE users SET deleted_at = COALESCE(updated_at, NOW()) WHERE is_deleted = 1;

ALTER TABLE users
  DROP INDEX uq_email_active,
  ADD UNIQUE KEY uq_email_active (active_email);

-- =============================================================================
-- 4. WORKFLOW MASTER
-- =============================================================================
ALTER TABLE workflow_master
  ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted,
  ADD COLUMN active_workflow_name VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, workflow_name, NULL)) STORED AFTER deleted_at;

UPDATE workflow_master SET deleted_at = COALESCE(updated_at, NOW()) WHERE is_deleted = 1;

ALTER TABLE workflow_master
  DROP INDEX uq_workflow_name_active,
  ADD UNIQUE KEY uq_workflow_name_active (active_workflow_name);

-- =============================================================================
-- 5. PROJECTS
-- =============================================================================
ALTER TABLE projects
  ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted,
  ADD COLUMN active_project_code VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, project_code, NULL)) STORED AFTER deleted_at;

UPDATE projects SET deleted_at = COALESCE(updated_at, NOW()) WHERE is_deleted = 1;

ALTER TABLE projects
  DROP INDEX uq_project_code_active,
  ADD UNIQUE KEY uq_project_code_active (active_project_code);

-- =============================================================================
-- 6. PURCHASE ORDERS
-- =============================================================================
ALTER TABLE purchase_orders
  ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted,
  ADD COLUMN active_po_number VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, po_number, NULL)) STORED AFTER deleted_at;

UPDATE purchase_orders SET deleted_at = COALESCE(updated_at, NOW()) WHERE is_deleted = 1;

ALTER TABLE purchase_orders
  DROP INDEX uq_po_number_active,
  ADD UNIQUE KEY uq_po_number_active (active_po_number);

-- =============================================================================
-- 7. CLAIMS
-- =============================================================================
ALTER TABLE claims
  ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted,
  ADD COLUMN active_claim_code VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, claim_code, NULL)) STORED AFTER deleted_at;

UPDATE claims SET deleted_at = COALESCE(updated_at, NOW()) WHERE is_deleted = 1;

ALTER TABLE claims
  DROP INDEX uq_claim_code_active,
  ADD UNIQUE KEY uq_claim_code_active (active_claim_code);

-- =============================================================================
-- Note:
-- The generated column (e.g. active_project_code) is NULL when the row is
-- deleted, and equals the unique field otherwise. MySQL allows multiple NULLs
-- in a UNIQUE index, so:
--   * Active rows: value must be unique  -> duplicate code/email rejected (409)
--   * Deleted rows: value is NULL        -> same code/email can be reused
-- Soft-delete now sets BOTH is_deleted = 1 AND deleted_at = NOW()
-- =============================================================================
