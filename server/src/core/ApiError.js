const { HttpStatus } = require('../types/httpStatus');

/** Typed error controllers/services throw instead of hand-building error JSON. */
class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(HttpStatus.BAD_REQUEST, message, details);
  }

  static unauthorized(message = 'Unauthorized', details) {
    return new ApiError(HttpStatus.UNAUTHORIZED, message, details);
  }

  static forbidden(message = 'Forbidden', details) {
    return new ApiError(HttpStatus.FORBIDDEN, message, details);
  }

  static notFound(message = 'Not found', details) {
    return new ApiError(HttpStatus.NOT_FOUND, message, details);
  }

  static conflict(message = 'Conflict', details) {
    return new ApiError(HttpStatus.CONFLICT, message, details);
  }

  static internal(message = 'Something went wrong on our end', details) {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message, details);
  }

  /** A 5xx whose message is written for the end user and safe to show them. */
  static unavailable(message, statusCode = 503) {
    const err = new ApiError(statusCode, message);
    err.expose = true;
    return err;
  }
}

module.exports = { ApiError };
