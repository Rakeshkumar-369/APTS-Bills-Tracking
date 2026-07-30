-- =============================================================================
-- APTS Bills Tracking System — Migration v2
-- Changes:
-- 1. Added is_deleted BOOLEAN DEFAULT FALSE to all soft-deletable tables
-- 2. Changed UNIQUE constraints to compound (field, is_deleted) to allow
--    re-creation of records with the same unique value when the old record
--    is deleted (is_deleted = 1)
-- 3. Added is_deleted filter to all existing data
-- =============================================================================

USE `apts_bills_tracking`;

-- =============================================================================
-- 1. ROLES
-- =============================================================================
ALTER TABLE roles
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_active;

-- Drop old UNIQUE on role_name, add compound unique with is_deleted
ALTER TABLE roles
  DROP INDEX role_name;
ALTER TABLE roles
  ADD UNIQUE KEY uq_role_name_active (role_name, is_deleted);

-- =============================================================================
-- 2. VENDORS
-- =============================================================================
ALTER TABLE vendors
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_active;

-- vendor_code is nullable UNIQUE — drop and re-add with is_deleted
ALTER TABLE vendors
  DROP INDEX vendor_code;
ALTER TABLE vendors
  ADD UNIQUE KEY uq_vendor_code_active (vendor_code, is_deleted);

-- =============================================================================
-- 3. USERS
-- =============================================================================
ALTER TABLE users
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_active;

-- Drop old UNIQUE on email, add compound unique with is_deleted
ALTER TABLE users
  DROP INDEX email;
ALTER TABLE users
  ADD UNIQUE KEY uq_email_active (email, is_deleted);

-- =============================================================================
-- 4. WORKFLOW MASTER
-- =============================================================================
ALTER TABLE workflow_master
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_active;

-- Drop old UNIQUE on workflow_name, add compound unique with is_deleted
ALTER TABLE workflow_master
  DROP INDEX workflow_name;
ALTER TABLE workflow_master
  ADD UNIQUE KEY uq_workflow_name_active (workflow_name, is_deleted);

-- =============================================================================
-- 5. PROJECTS
-- =============================================================================
ALTER TABLE projects
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_active;

-- project_code is nullable UNIQUE — drop and re-add with is_deleted
ALTER TABLE projects
  DROP INDEX project_code;
ALTER TABLE projects
  ADD UNIQUE KEY uq_project_code_active (project_code, is_deleted);

-- =============================================================================
-- 6. WORKFLOW STEPS
-- =============================================================================
ALTER TABLE workflow_steps
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_active;

-- =============================================================================
-- 7. WORKFLOW STEP TRANSITIONS
-- =============================================================================
ALTER TABLE workflow_step_transitions
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_active;

-- =============================================================================
-- 8. PURCHASE ORDERS
-- =============================================================================
ALTER TABLE purchase_orders
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_active;

-- Drop old UNIQUE on po_number, add compound unique with is_deleted
ALTER TABLE purchase_orders
  DROP INDEX po_number;
ALTER TABLE purchase_orders
  ADD UNIQUE KEY uq_po_number_active (po_number, is_deleted);

-- =============================================================================
-- 9. CLAIMS
-- =============================================================================
ALTER TABLE claims
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER is_completed;

-- Drop old UNIQUE on claim_code, add compound unique with is_deleted
ALTER TABLE claims
  DROP INDEX claim_code;
ALTER TABLE claims
  ADD UNIQUE KEY uq_claim_code_active (claim_code, is_deleted);

-- =============================================================================
-- 10. CLAIM HISTORY — Add from_user_id and to_user_id columns
-- =============================================================================
ALTER TABLE claim_history
  ADD COLUMN from_user_id INT NULL COMMENT 'USER who sent/initiated this action' AFTER to_step_id,
  ADD COLUMN to_user_id INT NULL COMMENT 'USER who received it — null for workflow step forwards' AFTER from_user_id,
  ADD INDEX idx_history_from_user (from_user_id),
  ADD INDEX idx_history_to_user (to_user_id);

-- Add foreign keys for new columns
ALTER TABLE claim_history
  ADD CONSTRAINT fk_history_from_user FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_history_to_user FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Backfill existing history: for CREATE actions, from_user_id = performed_by
UPDATE claim_history SET from_user_id = performed_by WHERE from_user_id IS NULL;

-- For FORWARD/ASSIGN actions (non-workflow), to_user_id = forwarded_to_user_id
UPDATE claim_history SET to_user_id = forwarded_to_user_id
WHERE action IN ('FORWARD', 'ASSIGN') AND forwarded_to_user_id IS NOT NULL AND to_user_id IS NULL;

-- For SENDBACK actions to vendor, to_user_id = forwarded_to_user_id
UPDATE claim_history SET to_user_id = forwarded_to_user_id
WHERE action = 'SENDBACK' AND forwarded_to_user_id IS NOT NULL AND to_user_id IS NULL;

-- For remaining, from_user_id = performed_by
UPDATE claim_history SET from_user_id = performed_by WHERE from_user_id IS NULL AND performed_by IS NOT NULL;

-- =============================================================================
-- 11. PO-VENDORS — Create junction table for multi-vendor PO assignment
-- =============================================================================
CREATE TABLE IF NOT EXISTS po_vendors (
  po_id      INT NOT NULL,
  vendor_id  INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (po_id, vendor_id),
  FOREIGN KEY (po_id)     REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing vendor_id data from purchase_orders into po_vendors
INSERT IGNORE INTO po_vendors (po_id, vendor_id)
SELECT id, vendor_id FROM purchase_orders WHERE vendor_id IS NOT NULL;

-- Remove vendor_id column from purchase_orders (data is now in po_vendors)
-- First drop the FK constraint, then the column
-- MySQL auto-generates FK names, so we need to find and drop it
SET @fk_name = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = 'apts_bills_tracking'
                  AND TABLE_NAME = 'purchase_orders'
                  AND COLUMN_NAME = 'vendor_id'
                  AND REFERENCED_TABLE_NAME IS NOT NULL
                LIMIT 1);
SET @fk_sql = IF(@fk_name IS NOT NULL, CONCAT('ALTER TABLE purchase_orders DROP FOREIGN KEY ', @fk_name), 'SELECT 1');
PREPARE stmt FROM @fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE purchase_orders DROP COLUMN vendor_id;

-- =============================================================================
-- 12. CLAIM FILES — Add is_deleted column for soft deletion
-- =============================================================================
ALTER TABLE claim_files
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER uploaded_by;

-- =============================================================================
-- 13. PO FILES — Add is_deleted column for soft deletion
-- =============================================================================
ALTER TABLE po_files
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER uploaded_by;

-- =============================================================================
-- Note: Existing seed data already has is_active = 1 for all seeded records.
-- The DEFAULT FALSE on is_deleted means all existing records will have
-- is_deleted = 0, which is correct — none of them have been "deleted".
-- =============================================================================
