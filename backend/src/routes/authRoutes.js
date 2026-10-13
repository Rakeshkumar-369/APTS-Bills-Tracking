// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');
const { loginValidation, changePasswordValidation } = require('../validators/authValidator');
const { authLimiter, createRateLimiter } = require('../middleware/rateLimiter');

// Token refresh happens on every page load / token expiry, so it gets a looser limit
const refreshLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300, keyPrefix: 'refresh' });

// Public routes
router.post('/login', authLimiter, loginValidation, authController.login);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post(
    '/change-password',
    authLimiter,
    authMiddleware,  // This ensures user is authenticated
    changePasswordValidation,
    authController.changePassword
);

module.exports = router;
