exports.up = function (knex) {
  return knex.schema.createTable('login_otps', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('code_hash').notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('consumed_at');
    table.integer('attempts').notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.index(['user_id', 'consumed_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('login_otps');
};
