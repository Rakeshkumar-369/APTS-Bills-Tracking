const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createPOValidation = [
  body('project_id')
    .notEmpty().withMessage('Project is required')
    .isInt({ min: 1 }).withMessage('Project ID must be a positive integer')
    .toInt(),
  body('vendor_id')
    .notEmpty().withMessage('Vendor is required')
    .isInt({ min: 1 }).withMessage('Vendor ID must be a positive integer')
    .toInt(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('amount')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Amount must be a positive number')
    .toFloat(),
  handleValidationErrors
];

const updatePOValidation = [
  body('project_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Project ID must be a positive integer')
    .toInt(),
  body('vendor_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Vendor ID must be a positive integer')
    .toInt(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('amount')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Amount must be a positive number')
    .toFloat(),
  body('status')
    .optional()
    .isIn(['ACTIVE', 'CLOSED', 'CANCELLED']).withMessage('Status must be ACTIVE, CLOSED, or CANCELLED'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  handleValidationErrors
];

module.exports = { createPOValidation, updatePOValidation };
