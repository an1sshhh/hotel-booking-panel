const { ApiResponse } = require('../../core/ApiResponse');
const bookingService = require('./service');

async function list(req, res, next) {
  try {
    ApiResponse.success(res, { data: await bookingService.listBookings(req.query) });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    ApiResponse.success(res, { data: await bookingService.getBookingById(req.params.id, req.user) });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const booking = await bookingService.updateBookingStatus(req.params.id, req.body.status, req.user.sub);
    ApiResponse.success(res, { data: booking });
  } catch (err) {
    next(err);
  }
}

async function cancellationQuote(req, res, next) {
  try {
    ApiResponse.success(res, { data: await bookingService.getCancellationQuote(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    ApiResponse.success(res, { data: await bookingService.cancelBooking(req.params.id, req.body, req.user.sub) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, updateStatus, cancellationQuote, cancel };
