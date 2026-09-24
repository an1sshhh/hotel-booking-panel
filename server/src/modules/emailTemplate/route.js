const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// Fixed paths before /:key so they aren't read as template keys.
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/settings', controller.getSettings);
router.put('/settings', controller.saveSettings);
router.get('/outbox', controller.outbox);
router.get('/outbox/:id', controller.view);
router.post('/outbox/:id/retry', controller.retry);

router.get('/:key', controller.get);
router.put('/:key', controller.update);
router.delete('/:key', controller.remove);
router.post('/:key/send', controller.send);
router.post('/:key/restore', controller.restore);
router.post('/:key/preview', controller.preview);
router.post('/:key/reset', controller.reset);
router.post('/:key/test', controller.sendTest);

module.exports = router;
