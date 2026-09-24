const { ApiResponse } = require('../../core/ApiResponse');
const { ApiError } = require('../../core/ApiError');
const hotelService = require('./service');

async function list(req, res, next) {
  try {
    const status = hotelService.filterParam(req.query.status);
    const city = hotelService.filterParam(req.query.city);
    const search = hotelService.filterParam(req.query.search);
    const hotels = await hotelService.listHotels({ status, city, search });
    ApiResponse.success(res, { data: hotels });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    ApiResponse.success(res, { data: await hotelService.getHotelById(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const hotel = await hotelService.createHotel(req.body, req.user.sub);
    ApiResponse.created(res, { data: hotel });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const hotel = await hotelService.updateHotel(req.params.id, req.body, req.user.sub);
    ApiResponse.success(res, { data: hotel });
  } catch (err) {
    next(err);
  }
}

async function addImage(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest('Image file is required');
    const image = await hotelService.addHotelImage(req.params.id, req.file, req.body.category);
    ApiResponse.created(res, { data: image });
  } catch (err) {
    next(err);
  }
}

async function setPrimaryImage(req, res, next) {
  try {
    ApiResponse.success(res, { data: await hotelService.setPrimaryImage(req.params.id, req.params.imageId) });
  } catch (err) {
    next(err);
  }
}

async function deleteImage(req, res, next) {
  try {
    await hotelService.deleteImage(req.params.id, req.params.imageId);
    ApiResponse.noContent(res);
  } catch (err) {
    next(err);
  }
}

async function updateAmenities(req, res, next) {
  try {
    const amenities = await hotelService.updateAmenities(req.params.id, req.body.amenityIds ?? []);
    ApiResponse.success(res, { data: amenities });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, addImage, setPrimaryImage, deleteImage, updateAmenities };
