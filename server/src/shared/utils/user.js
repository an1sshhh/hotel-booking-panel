const db = require('../../database/db');

function findByEmail(email) {
  return db('users').whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first();
}

module.exports = { findByEmail };
