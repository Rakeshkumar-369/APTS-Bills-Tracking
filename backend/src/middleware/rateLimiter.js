// src/middleware/rateLimiter.js
// Lightweight fixed-window rate limiter (per client IP, in memory).
// Protects login / refresh from credential stuffing and the API from abuse.
// For multi-instance deployments put an equivalent limit on the reverse proxy.
const ApiResponse = require('../utils/ApiResponse');

function createRateLimiter({ windowMs, max, message, keyPrefix = 'rl' }) {
  const hits = new Map();

  // Periodically drop expired windows so the map cannot grow without bound
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil((entry.resetAt - now) / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json(ApiResponse.error(message || 'Too many requests, please try again later.', []));
    }
    next();
  };
}

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);

// Login / token endpoints: 20 requests per IP per 15 minutes by default
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: num(process.env.RATE_LIMIT_AUTH_MAX, 20),
  keyPrefix: 'auth',
  message: 'Too many login attempts from this network. Please try again in a few minutes.'
});

// General API: 600 requests per IP per minute by default
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: num(process.env.RATE_LIMIT_API_MAX, 600),
  keyPrefix: 'api'
});

module.exports = { createRateLimiter, authLimiter, apiLimiter };
