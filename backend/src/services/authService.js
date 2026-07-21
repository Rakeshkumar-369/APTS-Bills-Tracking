// src/services/authService.js
const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepository');
const ApiError = require('../utils/ApiError');
const jwtHelper = require('../utils/jwtHelper');
const logger = require('../utils/logger');
const auditService = require('./auditService');

const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const FAKE_HASH = '$2a$10$X7YREkO9XG/vN.L1Z6Yq6.K7W6L5M4N3O2P1QzRySxTuUvVwWxXyY';

const login = async (email, password, ipAddress, userAgent) => {
  logger.debug(`  [authService] Attempting login for: ${email}`);

  // Check if email is blocked
  const blockStatus = await userRepo.getBlockedStatus(email);
  if (blockStatus && blockStatus.blocked_until && new Date(blockStatus.blocked_until) > new Date()) {
    const timeLeft = Math.ceil((new Date(blockStatus.blocked_until) - new Date()) / 60000);
    throw new ApiError(403, `Account temporarily blocked, try after ${timeLeft} minutes`);
  }

  // Find user by email
  const user = await userRepo.findByEmail(email);
  const hashToCompare = user ? user.password_hash : FAKE_HASH;
  const isValid = await bcrypt.compare(password, hashToCompare);

  // Handle failed login
  if (!isValid || !user) {
    const attempts = (blockStatus?.attempts || 0) + 1;

    if (attempts >= 5) {
      const blockTime = new Date(new Date().getTime() + BLOCK_DURATION);
      await userRepo.updateFailedLogin(email, true, blockTime);
    } else {
      await userRepo.updateFailedLogin(email, false, null);
    }

    // Log failed attempt
    await auditService.log({
      table_name: 'users',
      record_id: user?.id,
      action: 'LOGIN_FAILED',
      new_value: { email, reason: 'Invalid credentials' },
      performed_by: user?.id,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    if (attempts >= 5) {
      throw new ApiError(403, 'Account temporarily blocked, try after 15 minutes');
    }

    throw new ApiError(401, `Invalid credentials. ${5 - attempts} attempts remaining.`);
  }

  // Check if user account is active
  if (!user.is_active) {
    throw new ApiError(403, 'Account is not active');
  }

  // Store the last login time BEFORE updating it
  const lastLoginTime = user.last_login_time;

  // Success: Reset blocks, increment session version, update last login
  await userRepo.resetLoginAttempts(email);
  await userRepo.incrementSessionVersion(user.id);
  await userRepo.updateLastLoginTime(user.id, ipAddress);

  // Get updated session version
  const sessionVersion = await userRepo.getSessionVersion(user.id);

  // Delete all existing refresh tokens (single session policy with session_version)
  await userRepo.deleteUserRefreshTokens(user.id);

  // Generate tokens with session version (sv) for invalidation
  const payload = {
    sub: user.id,
    role_id: user.role_id,
    sv: sessionVersion
  };

  const accessToken = jwtHelper.generateToken(payload);
  const refreshToken = jwtHelper.generateRefreshToken(payload);

  // Store refresh token (hashed)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await userRepo.saveRefreshToken(user.id, refreshToken, expiresAt);

  // Log successful login
  await auditService.log({
    table_name: 'users',
    record_id: user.id,
    action: 'LOGIN_SUCCESS',
    new_value: { email, name: user.name },
    performed_by: user.id,
    ip_address: ipAddress,
    user_agent: userAgent
  });

  // Format last login time
  const formattedLastLogin = lastLoginTime
    ? new Date(lastLoginTime).toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(',', '')
    : null;

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      role_rank: user.role_rank,
      role_scope_type: user.role_scope_type,
      departments: user.departments,
      sub_departments: user.sub_departments,
      permissions: user.permissions,
      designation: user.designation,
      vendor_id: user.vendor_id,
      vendor_name: user.vendor_name,
      last_login: formattedLastLogin
    }
  };
};

const refreshAccessToken = async (receivedRefreshToken, ipAddress, userAgent) => {
  logger.debug('  [authService] Attempting to rotate access token');

  try {
    // Verify refresh token
    const decoded = jwtHelper.verifyRefreshToken(receivedRefreshToken);

    // Find stored token
    const storedToken = await userRepo.findRefreshToken(receivedRefreshToken);

    if (!storedToken) {
      throw new ApiError(401, 'Refresh token not found or revoked');
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      await userRepo.deleteRefreshToken(receivedRefreshToken);
      throw new ApiError(401, 'Refresh token expired');
    }

    // Get current session version
    const currentSessionVersion = await userRepo.getSessionVersion(decoded.sub);

    // Verify session version matches
    if (currentSessionVersion !== decoded.sv) {
      await userRepo.deleteRefreshToken(receivedRefreshToken);
      throw new ApiError(401, 'Session invalidated. Please login again.');
    }

    // Get user details
    const authenticatedUser = await userRepo.findById(decoded.sub);
    if (!authenticatedUser) {
      throw new ApiError(401, 'User not found');
    }

    // Delete old refresh token
    await userRepo.deleteRefreshToken(receivedRefreshToken);

    // Generate new tokens
    const payload = {
      sub: authenticatedUser.id,
      role_id: authenticatedUser.role_id,
      sv: currentSessionVersion
    };

    const newAccessToken = jwtHelper.generateToken(payload);
    const newRefreshToken = jwtHelper.generateRefreshToken(payload);

    // Save new refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepo.saveRefreshToken(authenticatedUser.id, newRefreshToken, expiresAt);

    // Log token refresh
    await auditService.log({
      table_name: 'refresh_tokens',
      record_id: storedToken.id,
      action: 'TOKEN_REFRESH',
      new_value: { userId: authenticatedUser.id, name: authenticatedUser.name },
      performed_by: authenticatedUser.id,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    logger.debug(`  [authService] Token rotation successful for: ${authenticatedUser.email}`);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: authenticatedUser.id,
        name: authenticatedUser.name,
        email: authenticatedUser.email,
        role_id: authenticatedUser.role_id,
        role_name: authenticatedUser.role_name,
        role_rank: authenticatedUser.role_rank,
        role_scope_type: authenticatedUser.role_scope_type,
        departments: authenticatedUser.departments,
        sub_departments: authenticatedUser.sub_departments,
        permissions: authenticatedUser.permissions,
        designation: authenticatedUser.designation,
        vendor_id: authenticatedUser.vendor_id,
        vendor_name: authenticatedUser.vendor_name
      }
    };
  } catch (error) {
    logger.error(`  [authService] Rotation failed: ${error.message}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid refresh token');
  }
};

const logout = async (accessToken, refreshToken, ipAddress, userAgent) => {
  try {
    // Decode token to get user_id
    const decoded = jwtHelper.decodeToken(accessToken);

    if (decoded && decoded.sub) {
      // Increment session version to invalidate ALL existing tokens
      await userRepo.incrementSessionVersion(decoded.sub);

      // Log logout
      await auditService.log({
        table_name: 'users',
        record_id: decoded.sub,
        action: 'LOGOUT',
        new_value: { session_version_incremented: true },
        performed_by: decoded.sub,
        ip_address: ipAddress,
        user_agent: userAgent
      });
    }

    // Delete refresh token if provided
    if (refreshToken) {
      await userRepo.deleteRefreshToken(refreshToken);
    }

    logger.debug('  [authService] Logout successful - session version incremented');
  } catch (error) {
    logger.error(`  [authService] Logout error: ${error.message}`);
    // Don't throw - logout should always succeed from user perspective
  }
};

const changePassword = async (userId, currentPassword, newPassword, ipAddress, userAgent) => {
  logger.debug(`  [authService] Changing password for user: ${userId}`);

  const user = await userRepo.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Verify current password
  const storedPasswordHash = await userRepo.verifyPassword(userId);
  const isValid = await bcrypt.compare(currentPassword, storedPasswordHash);

  if (!isValid) {
    await auditService.log({
      table_name: 'users',
      record_id: userId,
      action: 'PASSWORD_CHANGE_FAILED',
      new_value: { reason: 'Incorrect current password' },
      performed_by: userId,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    throw new ApiError(401, 'Current password is incorrect');
  }

  // Hash the new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Update password and increment session version
  const newSessionVersion = await userRepo.updatePassword(userId, newPasswordHash);

  // Delete all refresh tokens (complete logout from all sessions)
  await userRepo.deleteUserRefreshTokens(userId);

  // Log successful password change
  await auditService.log({
    table_name: 'users',
    record_id: userId,
    action: 'PASSWORD_CHANGE_SUCCESS',
    new_value: { new_session_version: newSessionVersion },
    performed_by: userId,
    ip_address: ipAddress,
    user_agent: userAgent
  });

  logger.debug(`  [authService] Password changed successfully for user: ${userId}`);

  return {
    message: 'Password changed successfully. Please login again with your new password.',
    sessionVersion: newSessionVersion
  };
};

module.exports = { login, refreshAccessToken, logout, changePassword };
