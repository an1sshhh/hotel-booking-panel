const { ApiResponse } = require('../../core/ApiResponse');
const couponService = require('./service');

async function list(req, res, next) {
  try {
    ApiResponse.success(res, { data: await couponService.listCoupons(req.query.active) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const coupon = await couponService.createCoupon(req.body);
    ApiResponse.created(res, { data: coupon });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    ApiResponse.success(res, { data: await couponService.updateCoupon(req.params.id, req.body) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await couponService.deleteCoupon(req.params.id);
    if (result.deactivated) return ApiResponse.success(res, { message: result.message });
    ApiResponse.noContent(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
