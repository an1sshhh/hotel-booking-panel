// Postgres doesn't auto-index foreign key columns; these are the FK/filter
// columns used in joins and where() that migration 12 didn't cover.
const INDEXES = {
  bookings: ['rate_plan_id', 'coupon_id'],
  payments: ['customer_id'],
  refunds: ['payment_id', 'booking_id'],
  reviews: ['customer_id', 'booking_id'],
  hotel_images: ['hotel_id'],
  room_images: ['room_type_id'],
  coupon_usages: ['booking_id'],
  audit_logs: ['admin_user_id'],
  room_types: ['hotel_id'],
  rate_plans: ['room_type_id'],
  rate_plan_inclusions: ['rate_plan_id'],
  cancellation_policies: ['rate_plan_id'],
};

exports.up = async function (knex) {
  for (const [tableName, columns] of Object.entries(INDEXES)) {
    await knex.schema.alterTable(tableName, (table) => {
      for (const column of columns) table.index(column);
    });
  }
};

exports.down = async function (knex) {
  for (const [tableName, columns] of Object.entries(INDEXES)) {
    await knex.schema.alterTable(tableName, (table) => {
      for (const column of columns) table.dropIndex(column);
    });
  }
};
