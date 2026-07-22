const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createVendorValidation = [
  body('vendor_name')
    .notEmpty().withMessage('Vendor name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Vendor name must be between 2 and 255 characters')
    .trim().escape(),
  body('vendor_code')
    .optional()
    .matches(/^[A-Z0-9]+$/).withMessage('Vendor code can only contain uppercase letters and numbers, no spaces')
    .trim().escape(),
  body('contact_person')
    .optional()
    .matches(/^[A-Za-z]+(?: [A-Za-z]+)*$/).withMessage('Contact person name can only contain alphabets and single spaces between words')
    .trim().escape(),
  body('email')
    .optional()
    .isEmail().withMessage('Valid email required')
    .normalizeEmail().trim(),
  body('phone')
    .optional()
    .matches(/^[6-9]\d{9}$/).withMessage('Phone must be a valid 10-digit Indian mobile number')
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
    .matches(/^[A-Z0-9]+$/).withMessage('Vendor code can only contain uppercase letters and numbers, no spaces')
    .trim().escape(),
  body('contact_person')
    .optional()
    .matches(/^[A-Za-z]+(?: [A-Za-z]+)*$/).withMessage('Contact person name can only contain alphabets and single spaces between words')
    .trim().escape(),
  body('email')
    .optional()
    .isEmail().withMessage('Valid email required')
    .normalizeEmail().trim(),
  body('phone')
    .optional()
    .matches(/^[6-9]\d{9}$/).withMessage('Phone must be a valid 10-digit Indian mobile number')
    .trim(),
  body('address')
    .optional()
    .trim(),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  handleValidationErrors
];

const assignVendorProjectValidation = [
  body('project_id')
    .notEmpty().withMessage('Project ID is required')
    .isInt({ min: 1 }).withMessage('Project ID must be a positive integer')
    .toInt(),
  handleValidationErrors
];

module.exports = { createVendorValidation, updateVendorValidation, assignVendorProjectValidation };
