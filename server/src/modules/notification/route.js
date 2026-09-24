const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.put('/:id/read', controller.markAsRead);
router.put('/read-all', controller.markAllAsRead);

module.exports = router;
