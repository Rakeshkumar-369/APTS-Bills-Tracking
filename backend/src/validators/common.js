// src/validators/common.js
const { query, param } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 400 })
    .withMessage('Limit must be between 1 and 400')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
    .toInt(),
  handleValidationErrors
];

const validateId = (name = 'id') => [
  param(name)
    .isInt({ min: 1 })
    .withMessage(`${name} must be a positive integer`)
    .toInt(),
  handleValidationErrors
];

module.exports = { validatePagination, validateId };