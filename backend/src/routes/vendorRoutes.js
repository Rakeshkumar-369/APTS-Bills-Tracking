const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vendorController = require('../controllers/vendorController');
const { createVendorValidation, updateVendorValidation } = require('../validators/vendorValidator');

router.use(authMiddleware);

// Vendor CRUD
router.get('/', requirePermission('vendor', 'read'), vendorController.getAllVendors);
router.get('/:id', requirePermission('vendor', 'read'), vendorController.getVendorById);
router.post('/', requirePermission('vendor', 'create'), createVendorValidation, vendorController.createVendor);
router.put('/:id', requirePermission('vendor', 'update'), updateVendorValidation, vendorController.updateVendor);
router.delete('/:id', requirePermission('vendor', 'delete'), vendorController.deleteVendor);

// Vendor-Project Assignment
// GET is open to any authenticated user (vendor users need to see their projects)
// POST/DELETE require vendor update permission (Super Admin only)
router.get('/:id/projects', vendorController.getVendorProjects);
router.post('/:id/projects', requirePermission('vendor', 'update'), vendorController.assignVendorProject);
router.delete('/:id/projects/:projectId', requirePermission('vendor', 'update'), vendorController.removeVendorProject);

module.exports = router;
