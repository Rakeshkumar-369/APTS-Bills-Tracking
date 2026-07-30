// src/utils/isActiveFilter.js

/**
 * Resolves the effective `is_active` filter based on the current user's role.
 *
 * Default: only active records (is_active = 1).
 * Only Super Admin can override by passing ?is_active=0 (or ?is_active=false).
 *
 * The `is_deleted` column is separate — records with is_deleted = 1 are NEVER
 * returned regardless of role, enforced at the repository level.
 *
 * @param {object} user - The authenticated user object (req.user).
 * @param {string|undefined} rawIsActive - The raw query param value from req.query.
 * @returns {number} 1 (active only) or 0 (inactive only).
 *
 * @example
 * // In any getAll controller:
 * const { is_active: rawIsActive } = req.query;
 * const effectiveIsActive = resolveIsActiveFilter(req.user, rawIsActive);
 */
function resolveIsActiveFilter(user, rawIsActive) {
  // Default: active only
  if (user?.role_name === 'Super Admin' && rawIsActive !== undefined) {
    return rawIsActive === 'true' || rawIsActive === '1' ? 1 : 0;
  }
  return 1;
}

module.exports = { resolveIsActiveFilter };
