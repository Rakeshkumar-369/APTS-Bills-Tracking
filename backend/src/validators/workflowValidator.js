const { body } = require('express-validator');
const { handleValidationErrors } = require('./authValidator');

const createWorkflowValidation = [
  body('workflow_name')
    .notEmpty().withMessage('Workflow name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Workflow name must be between 2 and 255 characters')
    .trim().escape(),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters')
    .trim().escape(),
  handleValidationErrors
];

const updateWorkflowValidation = [
  body('workflow_name')
    .optional()
    .isLength({ min: 2, max: 255 }).withMessage('Workflow name must be between 2 and 255 characters')
    .trim().escape(),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters')
    .trim().escape(),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  handleValidationErrors
];

const createWorkflowStepValidation = [
  body('step_name')
    .notEmpty().withMessage('Step name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Step name must be between 2 and 255 characters')
    .trim().escape(),
  body('step_order')
    .notEmpty().withMessage('Step order is required')
    .isInt({ min: 1 }).withMessage('Step order must be a positive integer')
    .toInt(),
  body('step_code')
    .optional()
    .matches(/^[A-Z0-9_]+$/).withMessage('Step code can only contain uppercase letters, numbers, and underscores, no spaces')
    .trim().escape(),
  body('is_optional')
    .optional()
    .isBoolean().withMessage('is_optional must be a boolean'),
  body('required_role_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Required role ID must be a positive integer')
    .toInt(),
  handleValidationErrors
];

const updateWorkflowStepValidation = [
  body('step_name')
    .optional()
    .isLength({ min: 2, max: 255 }).withMessage('Step name must be between 2 and 255 characters')
    .trim().escape(),
  body('step_order')
    .optional()
    .isInt({ min: 1 }).withMessage('Step order must be a positive integer')
    .toInt(),
  body('step_code')
    .optional()
    .matches(/^[A-Z0-9_]+$/).withMessage('Step code can only contain uppercase letters, numbers, and underscores, no spaces')
    .trim().escape(),
  body('is_optional')
    .optional()
    .isBoolean().withMessage('is_optional must be a boolean'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean'),
  body('required_role_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Required role ID must be a positive integer')
    .toInt(),
  handleValidationErrors
];

const createWorkflowTransitionValidation = [
  body('transition_type')
    .notEmpty().withMessage('Transition type is required')
    .isIn(['FORWARD', 'SENDBACK']).withMessage('Transition type must be FORWARD or SENDBACK')
    .trim(),
  body('from_step_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('From step ID must be a positive integer')
    .toInt(),
  body('to_step_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('To step ID must be a positive integer')
    .toInt(),
  body('allowed_role_id')
    .notEmpty().withMessage('Allowed role is required')
    .isInt({ min: 1 }).withMessage('Allowed role ID must be a positive integer')
    .toInt(),
  handleValidationErrors
];

module.exports = {
  createWorkflowValidation,
  updateWorkflowValidation,
  createWorkflowStepValidation,
  updateWorkflowStepValidation,
  createWorkflowTransitionValidation
};
