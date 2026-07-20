const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const vendorController = require('../controllers/vendorController');
const { createVendorValidation, updateVendorValidation } = require('../validators/vendorValidator');

router.use(authMiddleware);

router.get('/', requirePermission('vendor', 'read'), vendorController.getAllVendors);
router.get('/:id', requirePermission('vendor', 'read'), vendorController.getVendorById);
router.post('/', requirePermission('vendor', 'create'), createVendorValidation, vendorController.createVendor);
router.put('/:id', requirePermission('vendor', 'update'), updateVendorValidation, vendorController.updateVendor);
router.delete('/:id', requirePermission('vendor', 'delete'), vendorController.deleteVendor);

module.exports = router;
