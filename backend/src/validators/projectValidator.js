const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createProjectValidation = [
  body('project_name')
    .notEmpty().withMessage('Project name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Project name must be between 2 and 255 characters')
    .trim().escape(),
  body('project_code')
    .optional()
    .trim().escape(),
  body('description')
    .optional()
    .trim(),
  handleValidationErrors
];

const updateProjectValidation = [
  body('project_name')
    .optional()
    .isLength({ min: 2, max: 255 }).withMessage('Project name must be between 2 and 255 characters')
    .trim().escape(),
  body('project_code')
    .optional()
    .trim().escape(),
  body('description')
    .optional()
    .trim(),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  handleValidationErrors
];

module.exports = { createProjectValidation, updateProjectValidation };
