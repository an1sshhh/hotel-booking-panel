const { ApiResponse } = require('../../core/ApiResponse');
const paymentService = require('./service');

async function list(req, res, next) {
  try {
    ApiResponse.success(res, { data: await paymentService.listPayments(req.query.status) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    ApiResponse.success(res, { data: await paymentService.getPaymentById(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function createRefund(req, res, next) {
  try {
    const refund = await paymentService.createRefund(req.params.id, req.body, req.user.sub);
    ApiResponse.created(res, { data: refund });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, createRefund };
