const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const inboxController = require('../controllers/inboxController');
const { validatePagination } = require('../validators/common');

router.use(authMiddleware);

router.get('/', validatePagination, inboxController.getInbox);
router.get('/outbox', validatePagination, inboxController.getOutbox);
router.get('/stats', inboxController.getInboxStats);

module.exports = router;
