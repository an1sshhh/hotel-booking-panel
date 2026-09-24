const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();

router.get('/', controller.list);
router.post('/', requireAuth, requireRole('admin'), controller.create);

module.exports = router;
