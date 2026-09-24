exports.up = function (knex) {
  return knex.schema.createTable('rooms', (table) => {
    table.increments('id').primary();
    table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE');
    table.string('type').notNullable();
    table.decimal('price', 10, 2).notNullable();
    table.integer('capacity').notNullable().defaultTo(2);
    table.integer('total_rooms').notNullable().defaultTo(1);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('rooms');
};
