const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const analyticsController = require('../controllers/analyticsController');

// Organisation-wide figures: only MD (rank 90) and Super Admin (rank 100).
// Other roles (PM, TPA, JD-Infra ...) also hold report.view, so a rank check is required.
const requireExecutiveRank = (req, res, next) => {
  if (!req.user || Number(req.user.role_rank) < 90) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: analytics dashboard is restricted to MD and Super Admin',
      data: []
    });
  }
  next();
};

router.use(authMiddleware);
router.get('/overview', requirePermission('report', 'view'), requireExecutiveRank, analyticsController.getOverview);

module.exports = router;