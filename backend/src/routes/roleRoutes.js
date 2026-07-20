const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const roleController = require('../controllers/roleController');

router.use(authMiddleware);

router.get('/', requirePermission('role_management', 'read'), roleController.getAllRoles);
router.get('/:id', requirePermission('role_management', 'read'), roleController.getRoleById);
router.post('/', requirePermission('role_management', 'create'), roleController.createRole);
router.put('/:id', requirePermission('role_management', 'update'), roleController.updateRole);
router.delete('/:id', requirePermission('role_management', 'delete'), roleController.deleteRole);

module.exports = router;
