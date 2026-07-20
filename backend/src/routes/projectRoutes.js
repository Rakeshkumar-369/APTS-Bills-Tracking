const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const projectController = require('../controllers/projectController');
const { createProjectValidation, updateProjectValidation } = require('../validators/projectValidator');

router.use(authMiddleware);

router.get('/', requirePermission('procurement', 'read'), projectController.getAllProjects);
router.get('/:id', requirePermission('procurement', 'read'), projectController.getProjectById);
router.post('/', requirePermission('procurement', 'create'), createProjectValidation, projectController.createProject);
router.put('/:id', requirePermission('procurement', 'update'), updateProjectValidation, projectController.updateProject);
router.delete('/:id', requirePermission('procurement', 'delete'), projectController.deleteProject);

module.exports = router;
