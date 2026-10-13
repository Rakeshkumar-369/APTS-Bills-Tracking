const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createClaimValidation = [
  body('vendor_id')
    .notEmpty().withMessage('Vendor is required')
    .isInt({ min: 1 }).withMessage('Vendor ID must be a positive integer')
    .toInt(),
  body('vendor_contact_user_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Contact user ID must be a positive integer')
    .toInt(),
  body('project_id')
    .notEmpty().withMessage('Project is required')
    .isInt({ min: 1 }).withMessage('Project ID must be a positive integer')
    .toInt(),
  body('po_id')
    .notEmpty().withMessage('Purchase Order is required')
    .isInt({ min: 1 }).withMessage('Purchase Order ID must be a positive integer')
    .toInt(),
  body('remarks')
    .optional()
    .isLength({ max: 500 }).withMessage('Remarks must not exceed 500 characters')
    .trim()
    .escape(),
  body('claimed_amount')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0.01, max: 9999999999999 }).withMessage('Claimed amount must be a positive number')
    .toFloat(),
  body('invoice_number')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('Invoice number must not exceed 100 characters')
    .matches(/^[A-Za-z0-9][A-Za-z0-9/._ -]*$/).withMessage('Invoice number may contain letters, numbers, spaces and / . _ - only'),
  body('invoice_date')
    .optional({ values: 'falsy' })
    .isISO8601({ strict: true }).withMessage('Invoice date must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      if (new Date(value) > new Date()) throw new Error('Invoice date cannot be in the future');
      return true;
    }),
  handleValidationErrors
];

const actionValidation = [
  body('remarks')
    .notEmpty().withMessage('Remarks are mandatory')
    .isLength({ min: 3, max: 500 }).withMessage('Remarks must be between 3 and 500 characters')
    .trim()
    .escape(),
  handleValidationErrors
];

const assignClaimValidation = [
  body('target_user_id')
    .notEmpty().withMessage('Target user is required')
    .isInt({ min: 1 }).withMessage('Target user ID must be a positive integer')
    .toInt(),
  body('remarks')
    .notEmpty().withMessage('Remarks are mandatory')
    .isLength({ min: 3, max: 500 }).withMessage('Remarks must be between 3 and 500 characters')
    .trim()
    .escape(),
  handleValidationErrors
];

module.exports = { createClaimValidation, actionValidation, assignClaimValidation };
