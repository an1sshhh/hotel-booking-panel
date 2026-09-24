exports.up = function (knex) {
  return knex.schema.createTable('hotels', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('city').notNullable();
    table.string('address');
    table.text('description');
    table.decimal('base_price', 10, 2).notNullable().defaultTo(0);
    table.decimal('rating', 2, 1).defaultTo(0);
    table.string('image_url');
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('hotels');
};
