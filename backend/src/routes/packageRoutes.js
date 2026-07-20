const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { uploadSingleFile, handleMulterError } = require('../middleware/fileUploadMiddleware');
const packageController = require('../controllers/packageController');
const fileController = require('../controllers/fileController');
const { createPackageValidation, actionValidation } = require('../validators/packageValidator');

router.use(authMiddleware);

// Package CRUD
router.get('/', requirePermission('package', 'read'), packageController.getAllPackages);
router.get('/:id', requirePermission('package', 'read'), packageController.getPackageById);
router.post('/', requirePermission('package', 'create'), createPackageValidation, packageController.createPackage);

// Workflow actions
router.post('/:id/forward', requirePermission('package', 'forward'), actionValidation, packageController.forwardPackage);
router.post('/:id/sendback', requirePermission('package', 'sendback'), actionValidation, packageController.sendbackPackage);
router.post('/:id/resubmit', packageController.resubmitPackage);

// History
router.get('/:id/history', requirePermission('package', 'read'), packageController.getPackageHistory);

// Files
router.post('/:id/files', requirePermission('package', 'update'), uploadSingleFile, handleMulterError, packageController.uploadFile);
router.delete('/:id/files/:fileId', requirePermission('package', 'update'), packageController.deleteFile);

router.get('/:id/files/:fileId/download', authMiddleware, requirePermission('package', 'read'), fileController.servePackageFile);

module.exports = router;
