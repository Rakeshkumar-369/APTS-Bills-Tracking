const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createRoleValidation = [
  body('role_name')
    .notEmpty().withMessage('Role name is required')
    .isLength({ min: 2, max: 20 }).withMessage('Role name must be between 2 and 20 characters')
    .matches(/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/).withMessage('Role name can only contain alphabets, spaces, and hyphens between words')
    .trim().escape(),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters')
    .trim().escape(),
  body('role_rank')
    .optional()
    .isInt({ min: 0, max: 100 }).withMessage('Role rank must be between 0 and 100')
    .toInt(),
  body('permissions')
    .optional()
    .custom((value) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return true;
      }
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
          return true;
        } catch {
          throw new Error('Permissions must be a valid JSON object');
        }
      }
      throw new Error('Permissions must be a valid JSON object');
    }),
  handleValidationErrors
];

const updateRoleValidation = [
  body('role_name')
    .optional()
    .isLength({ min: 2, max: 20 }).withMessage('Role name must be between 2 and 20 characters')
    .matches(/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/).withMessage('Role name can only contain alphabets, spaces, and hyphens between words')
    .trim().escape(),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters')
    .trim().escape(),
  body('role_rank')
    .optional()
    .isInt({ min: 0, max: 100 }).withMessage('Role rank must be between 0 and 100')
    .toInt(),
  body('permissions')
    .optional()
    .custom((value) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return true;
      }
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
          return true;
        } catch {
          throw new Error('Permissions must be a valid JSON object');
        }
      }
      throw new Error('Permissions must be a valid JSON object');
    }),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  handleValidationErrors
];

module.exports = { createRoleValidation, updateRoleValidation };
