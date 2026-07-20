// src/middleware/errorMiddleware.js
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Global Error Handler Middleware
 * Ensuring tight security: We never leak stack traces or internal details to the client.
 */
const errorHandler = (err, req, res, next) => {
  // Prevent sending multiple responses
  if (res.headersSent) {
    return next(err);
  }

  // Extract request ID for log tracing (set by earlier middleware)
  const reqId = req.id || '????';

  let statusCode = 500;
  let message = 'Internal Server Error';

  // 1. Handle Known Operational Errors (e.g., Validation, Auth failures)
  if (err instanceof ApiError) {
    logger.warn(`[${reqId}] ⚠️  [Operational Error] ${err.message}`);
    statusCode = err.statusCode;
    message = err.message;
  }
  // 2. Handle Express-Validator / Body-Parser Syntax Errors
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON format';
  }
  // 2. Handle Payload Too Large
  else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }
  // 3. Handle Unexpected System Errors
  else {
    // CRITICAL: Log full stack trace ONLY in server logs (logs/error.log)
    logger.error(`[${reqId}] 🔥 [Unexpected Error] ${err.message}\n${err.stack}`);
    // Keep message generic for security
    message = 'An unexpected error occurred';
  }
  // 4. Return clean, secure response to the client
  // We NEVER include err.stack here, even in development.
  res.status(statusCode).json(ApiResponse.error(message, []));
};

module.exports = errorHandler;