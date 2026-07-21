const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createPackageValidation = [
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
  body('remarks')
    .optional()
    .isLength({ max: 500 }).withMessage('Remarks must not exceed 500 characters')
    .trim()
    .escape(),
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

module.exports = { createPackageValidation, actionValidation };
