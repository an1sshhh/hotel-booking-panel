const { randomUUID } = require('crypto');

/** Stamps every request with an id so it can be correlated across logs and the error envelope. */
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { requestId };
