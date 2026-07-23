// src/routes/workflowRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const workflowController = require('../controllers/workflowController');
const {
  createWorkflowValidation,
  updateWorkflowValidation,
  createWorkflowStepValidation,
  updateWorkflowStepValidation,
  createWorkflowTransitionValidation,
  updateWorkflowTransitionValidation
} = require('../validators/workflowValidator');
const { validatePagination, validateId } = require('../validators/common');

// All workflow routes require authentication
router.use(authMiddleware);

// Workflow master
router.get('/', validatePagination, workflowController.getAllWorkflows);
router.get('/:id', validateId(), workflowController.getWorkflowById);
router.post('/', requirePermission('workflow', 'manage'), createWorkflowValidation, workflowController.createWorkflow);
router.put('/:id', requirePermission('workflow', 'manage'), validateId(), updateWorkflowValidation, workflowController.updateWorkflow);

// Workflow steps
router.get('/:id/steps', validateId(), workflowController.getWorkflowSteps);
router.post('/:id/steps', requirePermission('workflow', 'configure_steps'), validateId(), createWorkflowStepValidation, workflowController.createWorkflowStep);
router.put('/workflow-steps/:id', requirePermission('workflow', 'configure_steps'), validateId(), updateWorkflowStepValidation, workflowController.updateWorkflowStep);
router.delete('/workflow-steps/:id', requirePermission('workflow', 'configure_steps'), validateId(), workflowController.deleteWorkflowStep);

// Workflow transitions
router.get('/:id/transitions', requirePermission('workflow', 'configure_steps'), validateId(), workflowController.getWorkflowTransitions);
router.post('/:id/transitions', requirePermission('workflow', 'configure_steps'), validateId(), createWorkflowTransitionValidation, workflowController.createWorkflowTransition);
router.put('/transitions/:id', requirePermission('workflow', 'configure_steps'), validateId(), updateWorkflowTransitionValidation, workflowController.updateWorkflowTransition);
router.delete('/transitions/:id', requirePermission('workflow', 'configure_steps'), validateId(), workflowController.deleteWorkflowTransition);

module.exports = router;
