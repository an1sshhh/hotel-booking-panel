exports.up = function (knex) {
  return knex.schema.createTable('bookings', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('room_id').unsigned().notNullable().references('id').inTable('rooms').onDelete('CASCADE');
    table.date('check_in').notNullable();
    table.date('check_out').notNullable();
    table.integer('guests').notNullable().defaultTo(1);
    table.decimal('total_price', 10, 2).notNullable();
    table.enu('status', ['pending', 'confirmed', 'cancelled']).notNullable().defaultTo('pending');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('bookings');
};
