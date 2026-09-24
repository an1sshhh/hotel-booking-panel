exports.up = async function (knex) {
  await knex.schema.raw('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check');
  await knex.schema.raw(`
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (booking_status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'refunded'))
  `);
  await knex.schema.raw(`
    ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
    CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'))
  `);
};

exports.down = async function (knex) {
  await knex.schema.raw('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check');
  await knex.schema.raw('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check');
  await knex.schema.raw(`
    ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (booking_status IN ('pending', 'confirmed', 'cancelled'))
  `);
};
