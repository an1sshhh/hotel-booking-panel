const { ApiResponse } = require('../../core/ApiResponse');
const reviewService = require('./service');

async function list(req, res, next) {
  try {
    ApiResponse.success(res, { data: await reviewService.listReviews(req.query) });
  } catch (err) {
    next(err);
  }
}

async function approve(req, res, next) {
  try {
    ApiResponse.success(res, { data: await reviewService.approveReview(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function hide(req, res, next) {
  try {
    ApiResponse.success(res, { data: await reviewService.hideReview(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await reviewService.deleteReview(req.params.id);
    ApiResponse.noContent(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, approve, hide, remove };
