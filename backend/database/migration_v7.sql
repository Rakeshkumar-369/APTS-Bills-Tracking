-- =============================================================================
-- Migration v7: Distinguish invoice vs certification documents on claims
-- =============================================================================
USE `apts_bills_tracking`;

ALTER TABLE claim_files
  ADD COLUMN document_type ENUM('INVOICE', 'CERTIFICATION') NOT NULL DEFAULT 'INVOICE'
  COMMENT 'INVOICE = bill/invoice documents, CERTIFICATION = optional certification documents'
  AFTER mime_type;