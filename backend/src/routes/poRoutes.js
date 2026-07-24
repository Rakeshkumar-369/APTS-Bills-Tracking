const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { uploadSingleFile, uploadMultipleFiles, handleMulterError } = require('../middleware/fileUploadMiddleware');
const poController = require('../controllers/poController');
const fileController = require('../controllers/fileController');
const { createPOValidation, updatePOValidation } = require('../validators/poValidator');
const { validatePagination, validateId } = require('../validators/common');

router.use(authMiddleware);

router.get('/', requirePermission('po', 'read'), validatePagination, poController.getAllPOs);
router.get('/:id', requirePermission('po', 'read'), validateId(), poController.getPOById);
router.post('/', requirePermission('po', 'create'), createPOValidation, poController.createPO);
router.put('/:id', requirePermission('po', 'update'), validateId(), updatePOValidation, poController.updatePO);
router.delete('/:id', requirePermission('po', 'delete'), validateId(), poController.deletePO);

// PO Files
router.post('/:id/files', requirePermission('po', 'update'), validateId(), uploadSingleFile, handleMulterError, poController.uploadPOFile);
router.delete('/:id/files/:fileId', requirePermission('po', 'update'), validateId('id'), validateId('fileId'), poController.deletePOFile);
router.get('/:id/files/:fileId/download', authMiddleware, requirePermission('po', 'read'), validateId('id'), validateId('fileId'), fileController.servePOFile);

module.exports = router;
