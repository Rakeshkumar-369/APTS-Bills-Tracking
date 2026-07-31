const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { uploadSingleFile, uploadMultipleFiles, handleMulterError } = require('../middleware/fileUploadMiddleware');
const claimController = require('../controllers/claimController');
const fileController = require('../controllers/fileController');
const { createClaimValidation, actionValidation, assignClaimValidation } = require('../validators/claimValidator');
const { validatePagination, validateId } = require('../validators/common');

router.use(authMiddleware);

// Claim CRUD
router.get('/', requirePermission('claim', 'read'), validatePagination, claimController.getAllClaims);
router.get('/:id', requirePermission('claim', 'read'), validateId(), claimController.getClaimById);
router.post('/', requirePermission('claim', 'create'), uploadMultipleFiles, handleMulterError, createClaimValidation, claimController.createClaim);

// Workflow actions (workflow mode)
router.post('/:id/forward', requirePermission('claim', 'forward'), validateId(), actionValidation, claimController.forwardClaim);

// Non-workflow actions
router.post('/:id/assign', requirePermission('claim', 'forward'), validateId(), assignClaimValidation, claimController.assignClaim);
// Pull-back is VENDOR ONLY (claim.pull_back permission lives only on the Vendor role)
router.post('/:id/pull-back', requirePermission('claim', 'pull_back'), validateId(), actionValidation, claimController.pullBackClaim);

// Common actions
router.post('/:id/sendback', requirePermission('claim', 'sendback'), validateId(), actionValidation, claimController.sendbackClaim);
// Approve & Complete — APTS Manager only (claim.approve permission)
router.post('/:id/approve', requirePermission('claim', 'approve'), validateId(), actionValidation, claimController.approveClaim);
router.post('/:id/resubmit', validateId(), actionValidation, claimController.resubmitClaim);

// History
router.get('/:id/history', requirePermission('claim', 'read'), validateId(), claimController.getClaimHistory);

// Files
router.post('/:id/files', requirePermission('claim', 'update'), validateId(), uploadSingleFile, handleMulterError, claimController.uploadFile);
router.delete('/:id/files/:fileId', requirePermission('claim', 'update'), validateId('id'), validateId('fileId'), claimController.deleteFile);

router.get('/:id/files/:fileId/download', authMiddleware, requirePermission('claim', 'read'), validateId('id'), validateId('fileId'), fileController.serveClaimFile);

module.exports = router;
