const { ApiResponse } = require('../../core/ApiResponse');
const amenityService = require('./service');

async function list(req, res, next) {
  try {
    ApiResponse.success(res, { data: await amenityService.listAmenities(req.query.scope) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const amenity = await amenityService.createAmenity(req.body);
    ApiResponse.created(res, { data: amenity });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create };
