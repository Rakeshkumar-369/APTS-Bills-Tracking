-- =============================================================================
-- Migration v8: Claimed amount + invoice reference on claims, and indexes for
-- the inbox / dashboard queries.
--   * claimed_amount  — amount the vendor is claiming in this bill
--   * invoice_number  — vendor's invoice / bill number
--   * invoice_date    — date printed on the invoice
-- All columns are NULL-able so existing claims remain valid.
-- =============================================================================
USE `apts_bills_tracking`;

ALTER TABLE claims
  ADD COLUMN claimed_amount DECIMAL(15,2) NULL COMMENT 'Amount claimed by the vendor in this bill' AFTER po_id,
  ADD COLUMN invoice_number VARCHAR(100) NULL COMMENT 'Vendor invoice / bill number' AFTER claimed_amount,
  ADD COLUMN invoice_date   DATE NULL COMMENT 'Date on the vendor invoice' AFTER invoice_number,
  ADD INDEX idx_claims_status (status, is_completed),
  ADD INDEX idx_claims_created (created_at),
  ADD INDEX idx_claims_po_amount (po_id, is_deleted);

ALTER TABLE claim_history
  ADD INDEX idx_history_claim_actor (claim_id, performed_by);
