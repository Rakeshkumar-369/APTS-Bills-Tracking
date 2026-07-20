const { hasPermission, hasAnyPermission } = require('../utils/permissionHelper');

const requirePermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No permissions found',
        data: []
      });
    }

    if (!hasPermission(req.user.permissions, module, action)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Missing "${action}" permission on "${module}"`,
        data: []
      });
    }

    next();
  };
};

const requireAnyPermission = (module, actions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No permissions found',
        data: []
      });
    }

    if (!hasAnyPermission(req.user.permissions, module, actions)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Missing any of "${actions.join(', ')}" permission on "${module}"`,
        data: []
      });
    }

    next();
  };
};

module.exports = { requirePermission, requireAnyPermission };
