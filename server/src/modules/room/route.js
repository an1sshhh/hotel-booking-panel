const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { upload } = require('../../middleware/upload.middleware');
const controller = require('./controller');

const router = express.Router();
const adminOnly = [requireAuth, requireRole('admin')];

// Mounted at '/' in app.js (paths already carry /hotels or /room-types), so
// auth is applied per-route — a router.use() here would guard every path.
router.get('/hotels/:hotelId/room-types', controller.listByHotel);
router.post('/hotels/:hotelId/room-types', ...adminOnly, controller.create);

router.get('/room-types/:id', controller.getById);
router.put('/room-types/:id', ...adminOnly, controller.update);

router.post('/room-types/:id/images', ...adminOnly, upload.single('image'), controller.addImage);
router.put('/room-types/:id/images/:imageId/primary', ...adminOnly, controller.setPrimaryImage);
router.delete('/room-types/:id/images/:imageId', ...adminOnly, controller.deleteImage);

router.put('/room-types/:id/amenities', ...adminOnly, controller.updateAmenities);

router.get('/room-types/:id/inventory', controller.getInventory);
router.put('/room-types/:id/inventory', ...adminOnly, controller.updateInventory);

module.exports = router;
