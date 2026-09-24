exports.up = async function (knex) {
  await knex.schema.alterTable('hotels', (table) => {
    table.string('hotel_type').notNullable().defaultTo('hotel'); // hotel, resort, villa, hostel, apartment, other
    table.integer('star_category'); // 1-5
    table.string('state');
    table.string('country');
    table.string('pincode');
    table.string('phone');
    table.string('email');
    table.string('website');
    table.decimal('latitude', 10, 7);
    table.decimal('longitude', 10, 7);
    table.string('status').notNullable().defaultTo('draft'); // draft, active, inactive, suspended

    // policies
    table.string('check_in_time').defaultTo('14:00');
    table.string('check_out_time').defaultTo('12:00');
    table.boolean('early_checkin_available').defaultTo(false);
    table.boolean('late_checkout_available').defaultTo(false);
    table.boolean('pets_allowed').defaultTo(false);
    table.boolean('smoking_allowed').defaultTo(false);
    table.boolean('children_allowed').defaultTo(true);
    table.text('policy_notes');

    table.integer('reviews_count').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('amenities', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('scope').notNullable().defaultTo('both'); // hotel, room, both
    table.boolean('is_custom').notNullable().defaultTo(false);
    table.unique(['name', 'scope']);
  });

  await knex.schema.createTable('hotel_images', (table) => {
    table.increments('id').primary();
    table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE');
    table.string('url').notNullable();
    table.string('category').defaultTo('other'); // exterior, lobby, rooms, bathroom, pool, restaurant, facilities, other
    table.boolean('is_primary').notNullable().defaultTo(false);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('hotel_amenities', (table) => {
    table.increments('id').primary();
    table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE');
    table.integer('amenity_id').unsigned().notNullable().references('id').inTable('amenities').onDelete('CASCADE');
    table.unique(['hotel_id', 'amenity_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('hotel_amenities');
  await knex.schema.dropTableIfExists('hotel_images');
  await knex.schema.dropTableIfExists('amenities');
  await knex.schema.alterTable('hotels', (table) => {
    table.dropColumn('hotel_type');
    table.dropColumn('star_category');
    table.dropColumn('state');
    table.dropColumn('country');
    table.dropColumn('pincode');
    table.dropColumn('phone');
    table.dropColumn('email');
    table.dropColumn('website');
    table.dropColumn('latitude');
    table.dropColumn('longitude');
    table.dropColumn('status');
    table.dropColumn('check_in_time');
    table.dropColumn('check_out_time');
    table.dropColumn('early_checkin_available');
    table.dropColumn('late_checkout_available');
    table.dropColumn('pets_allowed');
    table.dropColumn('smoking_allowed');
    table.dropColumn('children_allowed');
    table.dropColumn('policy_notes');
    table.dropColumn('reviews_count');
  });
};
