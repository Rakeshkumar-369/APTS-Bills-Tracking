const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { uploadSingleFile, uploadMultipleFiles, handleMulterError } = require('../middleware/fileUploadMiddleware');
const packageController = require('../controllers/packageController');
const fileController = require('../controllers/fileController');
const { createPackageValidation, actionValidation } = require('../validators/packageValidator');
const { validatePagination, validateId } = require('../validators/common');

router.use(authMiddleware);

// Package CRUD
router.get('/', requirePermission('package', 'read'), validatePagination, packageController.getAllPackages);
router.get('/:id', requirePermission('package', 'read'), validateId(), packageController.getPackageById);
router.post('/', requirePermission('package', 'create'), uploadMultipleFiles, handleMulterError, createPackageValidation, packageController.createPackage);

// Workflow actions
router.post('/:id/forward', requirePermission('package', 'forward'), validateId(), actionValidation, packageController.forwardPackage);
router.post('/:id/sendback', requirePermission('package', 'sendback'), validateId(), actionValidation, packageController.sendbackPackage);
router.post('/:id/resubmit', validateId(), actionValidation, packageController.resubmitPackage);

// History
router.get('/:id/history', requirePermission('package', 'read'), validateId(), packageController.getPackageHistory);

// Files
router.post('/:id/files', requirePermission('package', 'update'), validateId(), uploadSingleFile, handleMulterError, packageController.uploadFile);
router.delete('/:id/files/:fileId', requirePermission('package', 'update'), validateId('id'), validateId('fileId'), packageController.deleteFile);

router.get('/:id/files/:fileId/download', authMiddleware, requirePermission('package', 'read'), validateId('id'), validateId('fileId'), fileController.servePackageFile);

module.exports = router;
