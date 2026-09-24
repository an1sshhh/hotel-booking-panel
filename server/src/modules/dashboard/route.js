const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/stats', controller.stats);

module.exports = router;
