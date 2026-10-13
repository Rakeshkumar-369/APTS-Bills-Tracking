// src/controllers/authController.js
const authService = require('../services/authService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// HttpOnly refresh cookie — expires together with the refresh token itself
const refreshCookieOptions = (expiresAt) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  expires: expiresAt,
  path: '/'
});
const clearCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', path: '/' };

const login = async (req, res, next) => {
  logger.debug(`➜ [authController] Handling login request for: ${req.body.email}`);
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { accessToken, refreshToken, refreshExpiresAt, user } = await authService.login(email, password, ipAddress, userAgent);

    // Set Refresh Token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, refreshCookieOptions(refreshExpiresAt));

    logger.debug(`✅ [authController] Login successful for: ${email}`);
    res.json(ApiResponse.success('Login successful', [{ accessToken, user }]));
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  logger.debug('➜ [authController] Handling refresh request');
  try {
    const oldRefreshToken = req.cookies.refreshToken;
    if (!oldRefreshToken) {
      throw new ApiError(401, 'No refresh token provided');
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { accessToken, refreshToken, refreshExpiresAt, user } = await authService.refreshAccessToken(oldRefreshToken, ipAddress, userAgent);

    // Set NEW Refresh Token in HttpOnly cookie (Rotation)
    res.cookie('refreshToken', refreshToken, refreshCookieOptions(refreshExpiresAt));

    res.json(ApiResponse.success('Token refreshed', [{ accessToken, user }]));
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  logger.debug('➜ [authController] Handling logout request');
  try {
    const authHeader = req.headers.authorization;
    const refreshToken = req.cookies.refreshToken;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];
      await authService.logout(accessToken, refreshToken, ipAddress, userAgent);
    }

    // Clear the cookie
    res.clearCookie('refreshToken', clearCookieOptions);

    logger.debug('✅ [authController] Logout successful');
    res.json(ApiResponse.success('Logged out successfully', []));
  } catch (error) {
    logger.error(`❌ [authController] Logout failed: ${error.message}`);
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  logger.debug(`➜ [authController] Handling change password request for user: ${req.user.user_id}`);

  try {
    const { currentPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const userId = req.user.user_id;

    const result = await authService.changePassword(userId, currentPassword, newPassword, ipAddress, userAgent);

    // Clear the refresh token cookie since session is invalidated
    res.clearCookie('refreshToken', clearCookieOptions);

    logger.debug(`✅ [authController] Password changed successfully for user: ${userId}`);
    res.json(ApiResponse.success(result.message, []));
  } catch (error) {
    next(error);
  }
};

module.exports = { login, refresh, logout, changePassword };