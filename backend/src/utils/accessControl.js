// src/utils/accessControl.js
// Object-level authorisation helpers (prevents IDOR — a user reading or
// modifying records that belong to someone else just by changing an ID).
const pool = require('../config/db');
const ApiError = require('./ApiError');

const ADMIN_ROLES = ['Super Admin', 'Admin'];

const isAdminUser = (user) => ADMIN_ROLES.includes(user?.role_name);
const isVendorUser = (user) => user?.role_name === 'Vendor';

/**
 * Can this user see the given claim?
 *  - Super Admin / Admin: every claim
 *  - Vendor: only claims raised by their own vendor company
 *  - Officers: claims whose workflow contains a step for their role, claims
 *    they have acted on or received, or claims currently assigned to them
 */
async function canViewClaim(claim, user) {
  if (!claim || !user) return false;
  if (isAdminUser(user)) return true;
  if (isVendorUser(user)) return Boolean(user.vendor_id) && claim.vendor_id === user.vendor_id;

  if (claim.current_assigned_user_id === user.user_id) return true;

  const [rows] = await pool.query(
    `SELECT 1 FROM claims c
      WHERE c.id = ?
        AND (
          EXISTS (SELECT 1 FROM workflow_steps ws
                   WHERE ws.workflow_id = c.workflow_id AND ws.required_role_id = ? AND ws.is_deleted = false)
          OR EXISTS (SELECT 1 FROM claim_history ch
                      WHERE ch.claim_id = c.id AND (ch.performed_by = ? OR ch.to_user_id = ?))
        )
      LIMIT 1`,
    [claim.id, user.role_id, user.user_id, user.user_id]
  );
  return rows.length > 0;
}

async function assertCanViewClaim(claim, user) {
  if (!(await canViewClaim(claim, user))) {
    // 404 instead of 403 so record IDs cannot be enumerated
    throw new ApiError(404, 'Claim not found');
  }
}

/** Vendors may only see Purchase Orders assigned to their vendor company. */
async function assertCanViewPO(poId, user) {
  if (!isVendorUser(user)) return;
  const [rows] = await pool.query(
    'SELECT 1 FROM po_vendors WHERE po_id = ? AND vendor_id = ? LIMIT 1',
    [poId, user.vendor_id || 0]
  );
  if (rows.length === 0) throw new ApiError(404, 'Purchase Order not found');
}

/** Vendors may only see their own vendor company record. */
function assertCanViewVendor(vendorId, user) {
  if (isVendorUser(user) && Number(vendorId) !== Number(user.vendor_id)) {
    throw new ApiError(404, 'Vendor not found');
  }
}

module.exports = {
  isAdminUser,
  isVendorUser,
  canViewClaim,
  assertCanViewClaim,
  assertCanViewPO,
  assertCanViewVendor
};
