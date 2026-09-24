// Indexes for columns that are hit by WHERE/JOIN/ORDER BY in the admin list
// and lookup queries (see modules/booking, payment, review, auditLog, etc.)
// but weren't covered by a primary key or unique constraint.
exports.up = async function (knex) {
  await knex.schema.alterTable('bookings', (table) => {
    table.index('hotel_id');
    table.index('customer_id');
    table.index('room_type_id');
    table.index('booking_status');
    table.index('payment_status');
    table.index('created_at');
  });

  await knex.schema.alterTable('payments', (table) => {
    table.index('booking_id');
    table.index('status');
  });

  await knex.schema.alterTable('reviews', (table) => {
    table.index('hotel_id');
    table.index('status');
  });

  await knex.schema.alterTable('audit_logs', (table) => {
    table.index('entity_type');
    table.index('created_at');
  });

  await knex.schema.alterTable('notifications', (table) => {
    table.index('is_read');
    table.index('created_at');
  });

  await knex.schema.alterTable('coupon_usages', (table) => {
    table.index('coupon_id');
    table.index('customer_id');
  });

  await knex.schema.alterTable('hotels', (table) => {
    table.index('status');
    table.index('city');
  });

  await knex.schema.alterTable('users', (table) => {
    table.index('role_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex('role_id');
  });

  await knex.schema.alterTable('hotels', (table) => {
    table.dropIndex('status');
    table.dropIndex('city');
  });

  await knex.schema.alterTable('coupon_usages', (table) => {
    table.dropIndex('coupon_id');
    table.dropIndex('customer_id');
  });

  await knex.schema.alterTable('notifications', (table) => {
    table.dropIndex('is_read');
    table.dropIndex('created_at');
  });

  await knex.schema.alterTable('audit_logs', (table) => {
    table.dropIndex('entity_type');
    table.dropIndex('created_at');
  });

  await knex.schema.alterTable('reviews', (table) => {
    table.dropIndex('hotel_id');
    table.dropIndex('status');
  });

  await knex.schema.alterTable('payments', (table) => {
    table.dropIndex('booking_id');
    table.dropIndex('status');
  });

  await knex.schema.alterTable('bookings', (table) => {
    table.dropIndex('hotel_id');
    table.dropIndex('customer_id');
    table.dropIndex('room_type_id');
    table.dropIndex('booking_status');
    table.dropIndex('payment_status');
    table.dropIndex('created_at');
  });
};
