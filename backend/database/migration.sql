-- =============================================================================
-- APTS Bills Tracking System — Incremental Migration
-- Applies all changes for: Purchase Orders, optional workflows, Package→Claim
-- rename, manual officer assignment, and pull-back mechanism
-- =============================================================================

USE `apts_bills_tracking`;

-- =============================================================================
-- 1. Create purchase_orders table
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  po_number      VARCHAR(50) NOT NULL UNIQUE COMMENT 'Auto-generated: PO-YYYY-NNNN',
  project_id     INT NOT NULL,
  vendor_id      INT NOT NULL,
  description    TEXT NULL,
  amount         DECIMAL(15,2) NULL,
  status         ENUM('ACTIVE', 'CLOSED', 'CANCELLED') DEFAULT 'ACTIVE',
  is_active      BOOLEAN DEFAULT TRUE,
  created_by     INT NOT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (vendor_id)  REFERENCES vendors(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. Make workflow_id nullable in projects
-- =============================================================================
ALTER TABLE projects
  MODIFY COLUMN workflow_id INT NULL COMMENT 'NULL = no workflow (manual officer assignment)',
  DROP FOREIGN KEY projects_ibfk_1;

ALTER TABLE projects
  ADD CONSTRAINT projects_ibfk_1 FOREIGN KEY (workflow_id) REFERENCES workflow_master(id);

-- =============================================================================
-- 3. Rename packages → claims
-- =============================================================================
RENAME TABLE packages TO claims;

-- Add new columns to claims
ALTER TABLE claims
  ADD COLUMN po_id INT NULL COMMENT 'Purchase Order this claim belongs to' AFTER project_id,
  ADD COLUMN current_assigned_user_id INT NULL COMMENT 'Current holder (non-workflow mode)' AFTER current_step_order,
  ADD INDEX idx_claims_po (po_id),
  ADD INDEX idx_claims_assigned_user (current_assigned_user_id),
  ADD CONSTRAINT fk_claims_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
  ADD CONSTRAINT fk_claims_assigned_user FOREIGN KEY (current_assigned_user_id) REFERENCES users(id);

-- Make workflow_id nullable in claims
ALTER TABLE claims
  MODIFY COLUMN workflow_id INT NULL COMMENT 'NULL for non-workflow projects';

-- =============================================================================
-- 4. Rename package_files → claim_files
-- =============================================================================
RENAME TABLE package_files TO claim_files;

-- =============================================================================
-- 5. Rename package_history → claim_history, add forwarded_to_user_id column
-- =============================================================================
RENAME TABLE package_history TO claim_history;

ALTER TABLE claim_history
  ADD COLUMN forwarded_to_user_id INT NULL COMMENT 'Target user for manual assignment (non-workflow)' AFTER to_step_id,
  ADD INDEX idx_history_forwarded_user (forwarded_to_user_id),
  ADD CONSTRAINT fk_history_forwarded_user FOREIGN KEY (forwarded_to_user_id) REFERENCES users(id);

-- Modify action enum to include PULL_BACK
ALTER TABLE claim_history
  MODIFY COLUMN action ENUM('CREATE','FORWARD','SENDBACK','COMPLETE','REJECT','RESUBMIT','PULL_BACK') NOT NULL;

-- =============================================================================
-- 6. Update invoice_submissions FK reference (package_id → claim_id)
-- =============================================================================
ALTER TABLE invoice_submissions
  DROP FOREIGN KEY invoice_submissions_ibfk_1;

ALTER TABLE invoice_submissions
  CHANGE COLUMN package_id claim_id INT NOT NULL;

ALTER TABLE invoice_submissions
  ADD CONSTRAINT fk_invoice_claim FOREIGN KEY (claim_id) REFERENCES claims(id);

-- =============================================================================
-- 7. Create po_files table
-- =============================================================================
CREATE TABLE IF NOT EXISTS po_files (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  po_id          INT NOT NULL,
  original_name  VARCHAR(500) NOT NULL,
  stored_name    VARCHAR(255) NOT NULL COMMENT 'UUID-based name on disk',
  file_path      VARCHAR(1000) NOT NULL COMMENT 'Relative path from uploads root',
  file_size      BIGINT NOT NULL COMMENT 'Size in bytes',
  mime_type      VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  uploaded_by    INT NOT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 8. Insert Admin role (id=7, rank=80)
-- =============================================================================
INSERT IGNORE INTO roles (id, role_name, description, role_rank, permissions, is_active) VALUES
(7, 'Admin',
 'Purchase Order manager — manages POs and has RU access to other modules',
 80,
 '{
   "procurement": {"create":false,"read":true,"update":true,"delete":false,"advance":true,"comment":true,"upload_document":true},
   "workflow": {"manage":false,"configure_steps":false},
   "user_management": {"create":false,"read":true,"update":true,"delete":false,"assign_role":false},
   "role_management": {"create":false,"read":true,"update":false,"delete":false,"assign_permissions":false},
   "vendor": {"create":false,"read":true,"update":true,"delete":false},
   "claim": {"create":false,"read":true,"update":true,"delete":false,"forward":true,"sendback":true},
   "po": {"create":true,"read":true,"update":true,"delete":true},
   "payment": {"create":false,"read":true},
   "report": {"view":true,"export":false},
   "audit": {"view":true}
 }',
 1
);
