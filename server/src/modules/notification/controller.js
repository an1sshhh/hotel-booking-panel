const { ApiResponse } = require('../../core/ApiResponse');
const notificationService = require('./service');

async function list(req, res, next) {
  try {
    ApiResponse.success(res, { data: await notificationService.listNotifications(req.query.unreadOnly) });
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    ApiResponse.success(res, { data: await notificationService.markAsRead(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    await notificationService.markAllAsRead();
    ApiResponse.noContent(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, markAsRead, markAllAsRead };
