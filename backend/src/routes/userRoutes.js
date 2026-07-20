// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const userController = require('../controllers/userController');

// All user management routes require authentication and user_management permission
router.use(authMiddleware);

router.get('/', requirePermission('user_management', 'read'), userController.getAllUsers);
router.get('/roles', userController.getAllRoles);
router.get('/:id', requirePermission('user_management', 'read'), userController.getUserById);
router.post('/', requirePermission('user_management', 'create'), userController.createUser);
router.put('/:id', requirePermission('user_management', 'update'), userController.updateUser);
router.delete('/:id', requirePermission('user_management', 'delete'), userController.deleteUser);

module.exports = router;
