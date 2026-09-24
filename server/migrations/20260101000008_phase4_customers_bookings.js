exports.up = async function (knex) {
  await knex.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('email').notNullable().unique();
    table.string('phone');
    table.string('password_hash');
    table.string('status').notNullable().defaultTo('active'); // active, blocked
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('bookings', (table) => {
    table.dropForeign('room_id');
    table.dropColumn('room_id');
    table.dropForeign('user_id');
    table.dropColumn('user_id');

    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('SET NULL');
    table.integer('hotel_id').unsigned().references('id').inTable('hotels').onDelete('SET NULL');
    table.integer('room_type_id').unsigned().references('id').inTable('room_types').onDelete('SET NULL');
    table.integer('rate_plan_id').unsigned().references('id').inTable('rate_plans').onDelete('SET NULL');

    table.integer('nights').notNullable().defaultTo(1);
    table.integer('num_rooms').notNullable().defaultTo(1);
    table.decimal('room_price', 10, 2).notNullable().defaultTo(0);
    table.decimal('tax_amount', 10, 2).notNullable().defaultTo(0);
    table.decimal('fee_amount', 10, 2).notNullable().defaultTo(0);
    table.decimal('discount_amount', 10, 2).notNullable().defaultTo(0);
    table.integer('coupon_id').unsigned();

    table.renameColumn('total_price', 'total_amount');
    table.renameColumn('status', 'booking_status');
    table.string('payment_status').notNullable().defaultTo('pending');
  });

  await knex.schema.raw(`
    ALTER TABLE bookings ALTER COLUMN booking_status DROP DEFAULT;
    ALTER TABLE bookings ALTER COLUMN booking_status TYPE varchar(20);
    ALTER TABLE bookings ALTER COLUMN booking_status SET DEFAULT 'pending';
  `);
};

exports.down = async function (knex) {
  await knex.schema.alterTable('bookings', (table) => {
    table.dropColumn('customer_id');
    table.dropColumn('hotel_id');
    table.dropColumn('room_type_id');
    table.dropColumn('rate_plan_id');
    table.dropColumn('nights');
    table.dropColumn('num_rooms');
    table.dropColumn('room_price');
    table.dropColumn('tax_amount');
    table.dropColumn('fee_amount');
    table.dropColumn('discount_amount');
    table.dropColumn('coupon_id');
    table.dropColumn('payment_status');
    table.renameColumn('total_amount', 'total_price');
    table.renameColumn('booking_status', 'status');
  });
  await knex.schema.dropTableIfExists('customers');
};
