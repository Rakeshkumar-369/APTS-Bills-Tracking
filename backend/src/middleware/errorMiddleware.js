// src/middleware/errorMiddleware.js
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Extracts the field name from a MySQL ER_DUP_ENTRY error message.
 * Example: "Duplicate entry 'admin@test.com' for key 'uq_email_active'"
 * Returns a user-friendly field description.
 */
function extractDuplicateField(sqlMessage) {
  if (!sqlMessage) return 'field';

  const keyMatch = sqlMessage.match(/for key '(\w+)'/);
  if (!keyMatch) return 'field';

  const keyName = keyMatch[1].toLowerCase();

  // Map common unique key names to user-friendly labels
  const keyMap = {
    'uq_email_active': 'email',
    'uq_role_name_active': 'role name',
    'uq_vendor_code_active': 'vendor code',
    'uq_project_code_active': 'project code',
    'uq_workflow_name_active': 'workflow name',
    'uq_po_number_active': 'PO number',
    'uq_claim_code_active': 'claim code',
    'email': 'email',
    'role_name': 'role name',
    'vendor_code': 'vendor code',
    'project_code': 'project code',
    'workflow_name': 'workflow name',
    'po_number': 'PO number',
    'claim_code': 'claim code'
  };

  return keyMap[keyName] || keyName.replace(/_/g, ' ');
}

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
    // 2. Handle MySQL Unique Constraint Violations — return 409 instead of 500
  else if (err.code === 'ER_DUP_ENTRY') {
    const field = extractDuplicateField(err.sqlMessage);
    statusCode = 409;
    message = `A record with this ${field} already exists`;
    logger.warn(`[${reqId}] ⚠️  [Duplicate Entry] ${err.sqlMessage}`);
  }
  // 3. Handle Express-Validator / Body-Parser Syntax Errors
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON format';
  }
  // 4. Handle Payload Too Large
  else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }
  // 5. Handle Unexpected System Errors
  else {
    // CRITICAL: Log full stack trace ONLY in server logs (logs/error.log)
    logger.error(`[${reqId}] 🔥 [Unexpected Error] ${err.message}\n${err.stack}`);
    // Keep message generic for security
    message = 'An unexpected error occurred';
  }

  // 6. Return clean, secure response to the client
  res.status(statusCode).json(ApiResponse.error(message, []));
};

module.exports = errorHandler;