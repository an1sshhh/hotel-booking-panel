const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), controller.list);

// Must come before /:id so "mine" isn't captured as an id param.
router.get('/:id', requireAuth, controller.getById);
router.put('/:id/status', requireAuth, requireRole('admin'), controller.updateStatus);
router.get('/:id/cancellation-quote', requireAuth, requireRole('admin'), controller.cancellationQuote);
router.post('/:id/cancel', requireAuth, requireRole('admin'), controller.cancel);

module.exports = router;
