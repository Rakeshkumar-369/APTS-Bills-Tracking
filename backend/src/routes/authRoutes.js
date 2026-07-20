// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { changePasswordValidation } = require('../validators/authValidator');
const authController = require('../controllers/authController');
const { loginValidation } = require('../validators/authValidator');

// Public routes
router.post('/login', loginValidation, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post(
    '/change-password',
    authMiddleware,  // This ensures user is authenticated
    changePasswordValidation,
    authController.changePassword
);

module.exports = router;