const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  await knex('users').del();
  await knex('users').insert([
    {
      name: 'Guest User',
      email: 'guest@example.com',
      password_hash: bcrypt.hashSync('password123', 10),
      role: 'guest',
    },
    {
      name: 'Admin User',
      email: 'admin@example.com',
      password_hash: bcrypt.hashSync('admin123', 10),
      role: 'admin',
    },
  ]);
};
