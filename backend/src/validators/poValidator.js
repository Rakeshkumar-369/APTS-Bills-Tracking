const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createPOValidation = [
  body('project_id')
    .notEmpty().withMessage('Project is required')
    .isInt({ min: 1 }).withMessage('Project ID must be a positive integer')
    .toInt(),
  body('vendor_ids')
    .notEmpty().withMessage('At least one vendor is required'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('amount')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Amount must be a positive number')
    .toFloat(),
  body('delivery_start_date')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Delivery start date must be a valid date (YYYY-MM-DD)'),
  body('delivery_end_date')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Delivery end date must be a valid date (YYYY-MM-DD)'),
  body('delivered_on')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Delivered-on date must be a valid date (YYYY-MM-DD)'),
  handleValidationErrors
];

const updatePOValidation = [
  body('project_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Project ID must be a positive integer')
    .toInt(),
  body('vendor_ids')
    .optional({ nullable: true }),
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
  body('delivery_start_date')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Delivery start date must be a valid date (YYYY-MM-DD)'),
  body('delivery_end_date')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Delivery end date must be a valid date (YYYY-MM-DD)'),
  body('delivered_on')
    .optional({ values: 'falsy' })
    .isISO8601().withMessage('Delivered-on date must be a valid date (YYYY-MM-DD)'),
  handleValidationErrors
];

module.exports = { createPOValidation, updatePOValidation };