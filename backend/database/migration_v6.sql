-- =============================================================================
-- Migration v6: Vendor-entered delivery & installation dates (per PO, per vendor)
-- =============================================================================
USE `apts_bills_tracking`;

ALTER TABLE po_vendors
  ADD COLUMN vendor_delivery_date DATE NULL COMMENT 'Delivery date entered manually by the vendor' AFTER vendor_id,
  ADD COLUMN installation_date    DATE NULL COMMENT 'Installation date entered manually by the vendor' AFTER vendor_delivery_date,
  ADD COLUMN dates_updated_at     DATETIME NULL AFTER installation_date,
  ADD COLUMN dates_updated_by     INT NULL AFTER dates_updated_at;