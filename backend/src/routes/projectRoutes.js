const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const projectController = require('../controllers/projectController');
const { createProjectValidation, updateProjectValidation } = require('../validators/projectValidator');
const { validatePagination, validateId } = require('../validators/common');

router.use(authMiddleware);

router.get('/', requirePermission('procurement', 'read'), validatePagination, projectController.getAllProjects);
router.get('/:id', requirePermission('procurement', 'read'), validateId(), projectController.getProjectById);
router.post('/', requirePermission('procurement', 'create'), createProjectValidation, projectController.createProject);
router.put('/:id', requirePermission('procurement', 'update'), validateId(), updateProjectValidation, projectController.updateProject);
router.delete('/:id', requirePermission('procurement', 'delete'), validateId(), projectController.deleteProject);

module.exports = router;
