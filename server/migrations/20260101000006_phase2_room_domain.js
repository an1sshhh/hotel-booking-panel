exports.up = async function (knex) {
  await knex.schema.renameTable('rooms', 'room_types');

  await knex.schema.alterTable('room_types', (table) => {
    table.renameColumn('type', 'name');
  });

  await knex.schema.alterTable('room_types', (table) => {
    table.text('description');
    table.string('size_label'); // e.g. "210 sq.ft / 20 sq.mt"
    table.string('bed_type'); // queen, king, twin, double, single, sofa_bed
    table.integer('max_adults').notNullable().defaultTo(2);
    table.integer('max_children').notNullable().defaultTo(0);
    table.integer('max_occupancy').notNullable().defaultTo(2);
    table.string('room_view'); // city, pool, garden, sea, mountain, other
    table.string('status').notNullable().defaultTo('active'); // active, inactive, maintenance
    table.dropColumn('price');
  });

  await knex.schema.createTable('room_images', (table) => {
    table.increments('id').primary();
    table.integer('room_type_id').unsigned().notNullable().references('id').inTable('room_types').onDelete('CASCADE');
    table.string('url').notNullable();
    table.string('category').defaultTo('other'); // bedroom, bathroom, view, balcony, other
    table.boolean('is_primary').notNullable().defaultTo(false);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('room_amenities', (table) => {
    table.increments('id').primary();
    table.integer('room_type_id').unsigned().notNullable().references('id').inTable('room_types').onDelete('CASCADE');
    table.integer('amenity_id').unsigned().notNullable().references('id').inTable('amenities').onDelete('CASCADE');
    table.unique(['room_type_id', 'amenity_id']);
  });

  await knex.schema.createTable('room_inventory', (table) => {
    table.increments('id').primary();
    table.integer('room_type_id').unsigned().notNullable().references('id').inTable('room_types').onDelete('CASCADE');
    table.date('date').notNullable();
    table.integer('total').notNullable();
    table.integer('booked').notNullable().defaultTo(0);
    table.integer('blocked').notNullable().defaultTo(0);
    table.unique(['room_type_id', 'date']);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('room_inventory');
  await knex.schema.dropTableIfExists('room_amenities');
  await knex.schema.dropTableIfExists('room_images');
  await knex.schema.alterTable('room_types', (table) => {
    table.decimal('price', 10, 2).notNullable().defaultTo(0);
    table.dropColumn('description');
    table.dropColumn('size_label');
    table.dropColumn('bed_type');
    table.dropColumn('max_adults');
    table.dropColumn('max_children');
    table.dropColumn('max_occupancy');
    table.dropColumn('room_view');
    table.dropColumn('status');
  });
  await knex.schema.alterTable('room_types', (table) => {
    table.renameColumn('name', 'type');
  });
  await knex.schema.renameTable('room_types', 'rooms');
};
