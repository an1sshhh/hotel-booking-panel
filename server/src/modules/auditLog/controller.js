const { ApiResponse } = require('../../core/ApiResponse');
const auditLogService = require('./service');

async function list(req, res, next) {
  try {
    ApiResponse.success(res, { data: await auditLogService.listAuditLogs(req.query) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
