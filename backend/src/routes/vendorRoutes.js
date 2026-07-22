const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vendorController = require('../controllers/vendorController');
const { createVendorValidation, updateVendorValidation, assignVendorProjectValidation } = require('../validators/vendorValidator');
const { validatePagination, validateId } = require('../validators/common');

router.use(authMiddleware);

// Vendor CRUD
router.get('/', requirePermission('vendor', 'read'), validatePagination, vendorController.getAllVendors);
router.get('/:id', requirePermission('vendor', 'read'), validateId(), vendorController.getVendorById);
router.post('/', requirePermission('vendor', 'create'), createVendorValidation, vendorController.createVendor);
router.put('/:id', requirePermission('vendor', 'update'), validateId(), updateVendorValidation, vendorController.updateVendor);
router.delete('/:id', requirePermission('vendor', 'delete'), validateId(), vendorController.deleteVendor);

// Vendor-Project Assignment
// GET is open to any authenticated user (vendor users need to see their projects)
// POST/DELETE require vendor update permission (Super Admin only)
router.get('/:id/projects', validateId(), vendorController.getVendorProjects);
router.post('/:id/projects', requirePermission('vendor', 'update'), validateId(), assignVendorProjectValidation, vendorController.assignVendorProject);
router.delete('/:id/projects/:projectId', requirePermission('vendor', 'update'), validateId('id'), validateId('projectId'), vendorController.removeVendorProject);

module.exports = router;
