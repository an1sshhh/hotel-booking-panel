const { ApiResponse } = require('../../core/ApiResponse');
const { ApiError } = require('../../core/ApiError');
const roomService = require('./service');

async function listByHotel(req, res, next) {
  try {
    ApiResponse.success(res, { data: await roomService.listRoomTypesByHotel(req.params.hotelId) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    ApiResponse.success(res, { data: await roomService.getRoomTypeById(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function getInventory(req, res, next) {
  try {
    ApiResponse.success(res, { data: await roomService.getInventory(req.params.id, req.query) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const roomType = await roomService.createRoomType(req.params.hotelId, req.body);
    ApiResponse.created(res, { data: roomType });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    ApiResponse.success(res, { data: await roomService.updateRoomType(req.params.id, req.body) });
  } catch (err) {
    next(err);
  }
}

async function addImage(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest('Image file is required');
    const image = await roomService.addRoomImage(req.params.id, req.file, req.body.category);
    ApiResponse.created(res, { data: image });
  } catch (err) {
    next(err);
  }
}

async function setPrimaryImage(req, res, next) {
  try {
    ApiResponse.success(res, { data: await roomService.setPrimaryImage(req.params.id, req.params.imageId) });
  } catch (err) {
    next(err);
  }
}

async function deleteImage(req, res, next) {
  try {
    await roomService.deleteImage(req.params.id, req.params.imageId);
    ApiResponse.noContent(res);
  } catch (err) {
    next(err);
  }
}

async function updateAmenities(req, res, next) {
  try {
    const amenities = await roomService.updateAmenities(req.params.id, req.body.amenityIds ?? []);
    ApiResponse.success(res, { data: amenities });
  } catch (err) {
    next(err);
  }
}

async function updateInventory(req, res, next) {
  try {
    await roomService.updateInventory(req.params.id, req.body.dates);
    ApiResponse.noContent(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByHotel, getById, getInventory, create, update, addImage, setPrimaryImage, deleteImage, updateAmenities, updateInventory };
