exports.up = async function (knex) {
  await knex.schema.createTable('payments', (table) => {
    table.increments('id').primary();
    table.integer('booking_id').unsigned().notNullable().references('id').inTable('bookings').onDelete('CASCADE');
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('SET NULL');
    table.decimal('amount', 10, 2).notNullable();
    table.string('currency').notNullable().defaultTo('INR');
    table.string('method'); // card, upi, netbanking, wallet, cash
    table.string('status').notNullable().defaultTo('pending'); // pending, authorized, captured, failed, refunded, partially_refunded
    table.string('transaction_ref');
    table.string('gateway_ref');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('refunds', (table) => {
    table.increments('id').primary();
    table.integer('payment_id').unsigned().notNullable().references('id').inTable('payments').onDelete('CASCADE');
    table.integer('booking_id').unsigned().references('id').inTable('bookings').onDelete('SET NULL');
    table.decimal('amount', 10, 2).notNullable();
    table.string('reason');
    table.string('status').notNullable().defaultTo('pending'); // pending, processing, completed, failed
    table.timestamps(true, true);
  });

  await knex.schema.createTable('coupons', (table) => {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.string('discount_type').notNullable(); // percentage, fixed
    table.decimal('discount_value', 10, 2).notNullable();
    table.decimal('min_booking_amount', 10, 2).notNullable().defaultTo(0);
    table.decimal('max_discount', 10, 2);
    table.date('valid_from').notNullable();
    table.date('valid_until').notNullable();
    table.integer('usage_limit');
    table.integer('per_customer_limit');
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('coupon_hotels', (table) => {
    table.increments('id').primary();
    table.integer('coupon_id').unsigned().notNullable().references('id').inTable('coupons').onDelete('CASCADE');
    table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE');
    table.unique(['coupon_id', 'hotel_id']);
  });

  await knex.schema.createTable('coupon_room_types', (table) => {
    table.increments('id').primary();
    table.integer('coupon_id').unsigned().notNullable().references('id').inTable('coupons').onDelete('CASCADE');
    table.integer('room_type_id').unsigned().notNullable().references('id').inTable('room_types').onDelete('CASCADE');
    table.unique(['coupon_id', 'room_type_id']);
  });

  await knex.schema.createTable('coupon_rate_plans', (table) => {
    table.increments('id').primary();
    table.integer('coupon_id').unsigned().notNullable().references('id').inTable('coupons').onDelete('CASCADE');
    table.integer('rate_plan_id').unsigned().notNullable().references('id').inTable('rate_plans').onDelete('CASCADE');
    table.unique(['coupon_id', 'rate_plan_id']);
  });

  await knex.schema.createTable('coupon_usages', (table) => {
    table.increments('id').primary();
    table.integer('coupon_id').unsigned().notNullable().references('id').inTable('coupons').onDelete('CASCADE');
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('SET NULL');
    table.integer('booking_id').unsigned().references('id').inTable('bookings').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('bookings', (table) => {
    table.foreign('coupon_id').references('id').inTable('coupons').onDelete('SET NULL');
  });

  await knex.schema.createTable('reviews', (table) => {
    table.increments('id').primary();
    table.integer('hotel_id').unsigned().notNullable().references('id').inTable('hotels').onDelete('CASCADE');
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('SET NULL');
    table.integer('booking_id').unsigned().references('id').inTable('bookings').onDelete('SET NULL');
    table.integer('rating').notNullable(); // 1-5
    table.text('review_text');
    table.string('status').notNullable().defaultTo('pending'); // pending, published, hidden
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('reviews');
  await knex.schema.alterTable('bookings', (table) => {
    table.dropForeign('coupon_id');
  });
  await knex.schema.dropTableIfExists('coupon_usages');
  await knex.schema.dropTableIfExists('coupon_rate_plans');
  await knex.schema.dropTableIfExists('coupon_room_types');
  await knex.schema.dropTableIfExists('coupon_hotels');
  await knex.schema.dropTableIfExists('coupons');
  await knex.schema.dropTableIfExists('refunds');
  await knex.schema.dropTableIfExists('payments');
};
