const { types } = require('pg');
const knex = require('knex');
const config = require('../config');

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects,
// which avoids local-timezone shifting when the server isn't running in UTC.
types.setTypeParser(types.builtins.DATE, (value) => value);

module.exports = knex(config.knex);
