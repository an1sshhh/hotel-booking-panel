const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();
const adminOnly = [requireAuth, requireRole('admin')];

// Mounted at '/' in app.js, so auth is per-route rather than router.use().
router.post('/room-types/:roomTypeId/rate-plans', ...adminOnly, controller.create);

module.exports = router;
