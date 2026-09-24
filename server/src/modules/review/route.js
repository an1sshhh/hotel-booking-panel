const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.put('/:id/approve', controller.approve);
router.put('/:id/hide', controller.hide);
router.delete('/:id', controller.remove);

module.exports = router;
