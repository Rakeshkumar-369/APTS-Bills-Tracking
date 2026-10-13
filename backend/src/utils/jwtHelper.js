// src/utils/jwtHelper.js
const jwt = require('jsonwebtoken');
const config = require('../config');

// Access Token logic - short lived
const generateToken = (payload) => {
  // Payload should contain only: sub, role_id, department_id, sv
  return jwt.sign(payload, config.jwt.secret, { 
    expiresIn: config.jwt.expiresIn 
  });
};

const verifyToken = (token, options = {}) => {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'], ...options });
};

// Refresh Token logic - longer lived
// `absoluteExpiry` (unix seconds) lets a rotated refresh token keep the ORIGINAL
// session deadline, so an active session still ends after REFRESH_TOKEN_EXPIRES_IN
// (absolute session timeout) instead of sliding forever.
const generateRefreshToken = (payload, absoluteExpiry = null) => {
  const options = { jwtid: require('crypto').randomUUID() };
  const body = { ...payload };
  delete body.exp;
  delete body.iat;
  delete body.jti;
  if (absoluteExpiry) body.exp = absoluteExpiry;
  else options.expiresIn = config.jwt.refreshExpiresIn;
  return jwt.sign(body, config.jwt.refreshSecret, options);
};

/** Expiry of a signed token as a Date. */
const tokenExpiry = (token) => new Date(jwt.decode(token).exp * 1000);

const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret, { algorithms: ['HS256'] });
};

// Decode without verification (useful for extracting info from expired tokens)
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
  tokenExpiry,
  decodeToken
};