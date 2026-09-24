const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');
const controller = require('./controller');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/image', upload.single('image'), controller.setImage);
router.delete('/:id/image', controller.removeImage);

module.exports = router;
