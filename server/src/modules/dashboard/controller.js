const { ApiResponse } = require('../../core/ApiResponse');
const dashboardService = require('./service');

async function stats(req, res, next) {
  try {
    ApiResponse.success(res, { data: await dashboardService.getStats() });
  } catch (err) {
    next(err);
  }
}

module.exports = { stats };
