// src/utils/permissionHelper.js

/**
 * Parse permissions from various formats (JSON string, already-parsed object, etc.)
 * Returns a default permissions object if parsing fails.
 */
function parsePermissions(permissions) {
  if (!permissions) {
    return getDefaultPermissions();
  }

  // If already an object, return as-is
  if (typeof permissions === 'object' && !Array.isArray(permissions)) {
    return permissions;
  }

  // If string, try to parse as JSON
  if (typeof permissions === 'string') {
    try {
      return JSON.parse(permissions);
    } catch (e) {
      return getDefaultPermissions();
    }
  }

  return getDefaultPermissions();
}

/**
 * Default permissions (everything false - explicit deny)
 */
function getDefaultPermissions() {
  return {
    procurement:     { create: false, read: false, update: false, delete: false, advance: false, comment: false, upload_document: false },
    workflow:        { manage: false, configure_steps: false },
    department:      { manage: false },
    sub_department:  { manage: false },
    user_management: { create: false, read: false, update: false, delete: false, assign_role: false, assign_department: false },
    role_management: { create: false, read: false, update: false, delete: false, assign_permissions: false },
    vendor:          { create: false, read: false, update: false, delete: false },
    payment:         { create: false, read: false },
    report:          { view: false, export: false },
    audit:           { view: false }
  };
}

/**
 * Check if a user has a specific permission
 * @param {object} permissions - The parsed permissions object from req.user
 * @param {string} module - e.g., 'procurement', 'user_management'
 * @param {string} action - e.g., 'create', 'update', 'delete'
 * @returns {boolean}
 */
function hasPermission(permissions, module, action) {
  const parsed = parsePermissions(permissions);
  return !!(parsed[module] && parsed[module][action]);
}

/**
 * Check if user has any of the specified permissions
 * @param {object} permissions - The parsed permissions object
 * @param {string} module - e.g., 'procurement'
 * @param {string[]} actions - e.g., ['create', 'update']
 * @returns {boolean}
 */
function hasAnyPermission(permissions, module, actions) {
  const parsed = parsePermissions(permissions);
  if (!parsed[module]) return false;
  return actions.some(action => !!parsed[module][action]);
}

/**
 * Check if user has ALL of the specified permissions
 * @param {object} permissions
 * @param {string} module
 * @param {string[]} actions
 * @returns {boolean}
 */
function hasAllPermissions(permissions, module, actions) {
  const parsed = parsePermissions(permissions);
  if (!parsed[module]) return false;
  return actions.every(action => !!parsed[module][action]);
}

module.exports = {
  parsePermissions,
  getDefaultPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions
};
