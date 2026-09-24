const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.catalog);
router.get('/:key', controller.run);
router.get('/:key/export', controller.exportFile);

module.exports = router;
