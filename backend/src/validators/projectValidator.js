const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createProjectValidation = [
  body('project_name')
    .notEmpty().withMessage('Project name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Project name must be between 2 and 255 characters')
    .trim().escape(),
  body('project_code')
    .optional()
    .matches(/^[A-Z0-9-]+$/).withMessage('Project code can only contain uppercase letters, numbers, and hyphens, no spaces')
    .trim().escape(),
  body('description')
    .optional()
    .trim(),
  body('workflow_id')
    .notEmpty().withMessage('Workflow is required — each project must be assigned a workflow')
    .isInt({ min: 1 }).withMessage('Workflow ID must be a positive integer')
    .toInt(),
  handleValidationErrors
];

const updateProjectValidation = [
  body('project_name')
    .optional()
    .isLength({ min: 2, max: 255 }).withMessage('Project name must be between 2 and 255 characters')
    .trim().escape(),
  body('project_code')
    .optional()
    .matches(/^[A-Z0-9-]+$/).withMessage('Project code can only contain uppercase letters, numbers, and hyphens, no spaces')
    .trim().escape(),
  body('description')
    .optional()
    .trim(),
  body('workflow_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Workflow ID must be a positive integer')
    .toInt(),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  handleValidationErrors
];

module.exports = { createProjectValidation, updateProjectValidation };
