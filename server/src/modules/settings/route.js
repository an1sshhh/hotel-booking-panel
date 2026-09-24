const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.getAll);
router.put('/:key', controller.upsert);

router.get('/tax-rules', controller.listTaxRules);
router.post('/tax-rules', controller.createTaxRule);
router.put('/tax-rules/:id', controller.updateTaxRule);

module.exports = router;
