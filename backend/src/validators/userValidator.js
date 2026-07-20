const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createUserValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail().trim().toLowerCase(),
  body('password')
    .isLength({ min: 8, max: 16 }).withMessage('Password must be between 8 and 16 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase, one uppercase, one number, and one special character'),
  body('name')
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters')
    .trim().escape(),
  body('role_id')
    .notEmpty().withMessage('Role is required')
    .isInt({ min: 1 }).withMessage('Role must be a valid ID')
    .toInt(),
  body('vendor_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Vendor ID must be a positive integer')
    .toInt(),
  body('designation')
    .optional()
    .trim().escape(),
  body('phone')
    .optional()
    .trim(),
  handleValidationErrors
];

const updateUserValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters')
    .trim().escape(),
  body('role_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Role must be a valid ID')
    .toInt(),
  body('vendor_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Vendor ID must be a positive integer')
    .toInt(),
  body('designation')
    .optional()
    .trim().escape(),
  body('phone')
    .optional()
    .trim(),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  body('has_digital_signature')
    .optional()
    .isBoolean().withMessage('has_digital_signature must be a boolean'),
  handleValidationErrors
];

module.exports = { createUserValidation, updateUserValidation };
