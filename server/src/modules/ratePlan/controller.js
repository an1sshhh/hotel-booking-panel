const { ApiResponse } = require('../../core/ApiResponse');
const ratePlanService = require('./service');

async function create(req, res, next) {
  try {
    const ratePlan = await ratePlanService.createRatePlan(req.params.roomTypeId, req.body);
    ApiResponse.created(res, { data: ratePlan });
  } catch (err) {
    next(err);
  }
}

module.exports = { create };
