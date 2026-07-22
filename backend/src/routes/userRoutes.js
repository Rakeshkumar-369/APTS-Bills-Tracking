// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const userController = require('../controllers/userController');
const { createUserValidation, updateUserValidation } = require('../validators/userValidator');
const { validatePagination, validateId } = require('../validators/common');

// All user management routes require authentication and user_management permission
router.use(authMiddleware);

router.get('/', requirePermission('user_management', 'read'), validatePagination, userController.getAllUsers);
router.get('/roles', userController.getAllRoles);
router.get('/:id', requirePermission('user_management', 'read'), validateId(), userController.getUserById);
router.post('/', requirePermission('user_management', 'create'), createUserValidation, userController.createUser);
router.put('/:id', requirePermission('user_management', 'update'), validateId(), updateUserValidation, userController.updateUser);
router.delete('/:id', requirePermission('user_management', 'delete'), validateId(), userController.deleteUser);

module.exports = router;
