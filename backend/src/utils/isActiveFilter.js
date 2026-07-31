// src/utils/isActiveFilter.js

/**
 * Resolves the effective `is_active` filter based on the current user's role.
 *
 * - Super Admin: sees BOTH active and inactive records by default (no filter).
 *   Can explicitly pass ?is_active=0 or ?is_active=1 to narrow to one state.
 * - Everyone else: locked to active records only (is_active = 1) — they can
 *   never retrieve inactive records, regardless of the query param.
 *
 * The `is_deleted` column is separate — records with is_deleted = 1 are NEVER
 * returned regardless of role, enforced at the repository level.
 *
 * @param {object} user - The authenticated user object (req.user).
 * @param {string|undefined} rawIsActive - The raw query param value from req.query.
 * @returns {number|undefined} 1 (active only), 0 (inactive only), or undefined
 *   (no filter → both active & inactive). Repositories skip the is_active
 *   condition when the value is undefined.
 *
 * @example
 * // In any getAll controller:
 * const { is_active: rawIsActive } = req.query;
 * const effectiveIsActive = resolveIsActiveFilter(req.user, rawIsActive);
 */
function resolveIsActiveFilter(user, rawIsActive) {
  // Super Admin: no param → show everything (active + inactive, but never deleted)
  if (user?.role_name === 'Super Admin') {
    if (rawIsActive === undefined) {
      return undefined; // repository skips the is_active condition → both states
    }
    return rawIsActive === 'true' || rawIsActive === '1' ? 1 : 0;
  }
  // Everyone else: active only
  return 1;
}

module.exports = { resolveIsActiveFilter };
