const { ApiResponse } = require('../../core/ApiResponse');
const customerService = require('./service');

async function create(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.body);
    ApiResponse.created(res, { data: customer });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    ApiResponse.success(res, { data: await customerService.listCustomers(req.query) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    ApiResponse.success(res, { data: await customerService.getCustomerById(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const customer = await customerService.updateCustomerStatus(req.params.id, req.body.status);
    ApiResponse.success(res, { data: customer });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, updateStatus };
