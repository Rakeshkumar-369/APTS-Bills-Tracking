const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createVendorValidation = [
  body('vendor_name')
    .notEmpty().withMessage('Vendor name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Vendor name must be between 2 and 255 characters')
    .trim().escape(),
  body('vendor_code')
    .optional()
    .trim().escape(),
  body('contact_person')
    .optional()
    .trim().escape(),
  body('email')
    .optional()
    .isEmail().withMessage('Valid email required')
    .normalizeEmail().trim(),
  body('phone')
    .optional()
    .trim(),
  body('address')
    .optional()
    .trim(),
  handleValidationErrors
];

const updateVendorValidation = [
  body('vendor_name')
    .optional()
    .isLength({ min: 2, max: 255 }).withMessage('Vendor name must be between 2 and 255 characters')
    .trim().escape(),
  body('vendor_code')
    .optional()
    .trim().escape(),
  body('contact_person')
    .optional()
    .trim().escape(),
  body('email')
    .optional()
    .isEmail().withMessage('Valid email required')
    .normalizeEmail().trim(),
  body('phone')
    .optional()
    .trim(),
  body('address')
    .optional()
    .trim(),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  handleValidationErrors
];

module.exports = { createVendorValidation, updateVendorValidation };
