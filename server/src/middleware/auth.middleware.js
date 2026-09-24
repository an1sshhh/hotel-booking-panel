const jwt = require('jsonwebtoken');
const config = require('../config');
const { ApiError } = require('../core/ApiError');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or invalid Authorization header'));
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return next(ApiError.forbidden());
    next();
  };
}

module.exports = { requireAuth, requireRole };
