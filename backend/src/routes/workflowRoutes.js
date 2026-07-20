// src/routes/workflowRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const workflowController = require('../controllers/workflowController');

// All workflow routes require authentication
router.use(authMiddleware);

// Workflow master
router.get('/', workflowController.getAllWorkflows);
router.get('/:id', workflowController.getWorkflowById);
router.post('/', requirePermission('workflow', 'manage'), workflowController.createWorkflow);
router.put('/:id', requirePermission('workflow', 'manage'), workflowController.updateWorkflow);

// Workflow steps
router.get('/:id/steps', workflowController.getWorkflowSteps);
router.post('/:id/steps', requirePermission('workflow', 'configure_steps'), workflowController.createWorkflowStep);
router.put('/workflow-steps/:id', requirePermission('workflow', 'configure_steps'), workflowController.updateWorkflowStep);
router.delete('/workflow-steps/:id', requirePermission('workflow', 'configure_steps'), workflowController.deleteWorkflowStep);

// Workflow transitions
router.get('/:id/transitions', requirePermission('workflow', 'configure_steps'), workflowController.getWorkflowTransitions);
router.post('/:id/transitions', requirePermission('workflow', 'configure_steps'), workflowController.createWorkflowTransition);
router.delete('/transitions/:id', requirePermission('workflow', 'configure_steps'), workflowController.deleteWorkflowTransition);

module.exports = router;
