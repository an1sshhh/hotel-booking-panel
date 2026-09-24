const multer = require('multer');
const { HttpStatus } = require('../types/httpStatus');
const { ApiError } = require('./ApiError');
const logger = require('../shared/loggers/logger');

/** Response envelope helpers — controllers never build res.json(...) by hand. */
class ApiResponse {
  static success(res, { statusCode = HttpStatus.OK, message = 'OK', data = null } = {}) {
    res.status(statusCode).json({ success: true, statusCode, message, data });
  }

  static created(res, { message = 'Created', data = null } = {}) {
    ApiResponse.success(res, { statusCode: HttpStatus.CREATED, message, data });
  }

  static noContent(res) {
    res.status(HttpStatus.NO_CONTENT).send();
  }

  static render(res, view, locals) {
    res.render(view, locals);
  }

  static redirect(res, url) {
    res.redirect(url);
  }
}

// Postgres errors worth translating instead of returning a bare 500.
const PG_MESSAGES = {
  '23505': 'That record already exists',
  '23503': 'Related record not found',
  '23502': 'A required field is missing',
  '22003': 'A numeric value is out of the allowed range',
  '22P02': 'A value has the wrong format',
  '23514': 'A value is not allowed by the database constraints',
};

function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : `Upload failed: ${err.message}`;
    return ApiError.badRequest(message);
  }
  if (err.message === 'Only JPEG, PNG, WEBP or GIF images are allowed') {
    return ApiError.badRequest(err.message);
  }
  if (err.code && PG_MESSAGES[err.code]) {
    return ApiError.badRequest(PG_MESSAGES[err.code]);
  }

  return ApiError.internal(err.message);
}

/**
 * Single global error middleware, registered once in app.js. Normalizes
 * anything thrown (ApiError or not) into one JSON envelope.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
function apiErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const apiError = normalize(err);
  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${apiError.message}`, { requestId: req.id, stack: err.stack });
  }

  res.status(apiError.statusCode).json({
    success: false,
    statusCode: apiError.statusCode,
    message: apiError.statusCode >= 500 && !apiError.expose ? 'Something went wrong on our end' : apiError.message,
    ...(apiError.details ? { details: apiError.details } : {}),
    requestId: req.id,
  });
}

/** 404 for unmatched routes, so clients get the same JSON envelope instead of Express's HTML page. */
function notFoundHandler(req, res) {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    statusCode: HttpStatus.NOT_FOUND,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.id,
  });
}

module.exports = { ApiResponse, apiErrorHandler, notFoundHandler };
