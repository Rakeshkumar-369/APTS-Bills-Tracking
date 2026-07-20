const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const inboxController = require('../controllers/inboxController');

router.use(authMiddleware);

router.get('/', inboxController.getInbox);
router.get('/outbox', inboxController.getOutbox);
router.get('/stats', inboxController.getInboxStats);

module.exports = router;
