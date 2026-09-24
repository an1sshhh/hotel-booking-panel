// Checkout + Razorpay: guest contact details and a payment hold window on
// bookings, gateway identifiers on payments/refunds, and a human-friendly
// booking reference (e.g. SF7K3Q9M) shown on vouchers instead of the raw id.
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeRef() {
  let ref = 'SF';
  for (let i = 0; i < 6; i++) ref += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return ref;
}

exports.up = async function (knex) {
  await knex.schema.alterTable('bookings', (table) => {
    table.string('booking_ref', 16);
    table.string('guest_name');
    table.string('guest_email');
    table.string('guest_phone');
    table.text('special_requests');
    table.timestamp('hold_expires_at');
    table.text('cancellation_reason');
    table.timestamp('cancelled_at');
    table.integer('cancelled_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  });

  const existing = await knex('bookings').select('id');
  const used = new Set();
  for (const { id } of existing) {
    let ref = makeRef();
    while (used.has(ref)) ref = makeRef();
    used.add(ref);
    await knex('bookings').where({ id }).update({ booking_ref: ref });
  }

  await knex.schema.alterTable('bookings', (table) => {
    table.unique(['booking_ref']);
    table.index('hold_expires_at');
  });

  await knex.schema.alterTable('payments', (table) => {
    table.string('gateway');
    table.string('razorpay_order_id');
    table.string('razorpay_payment_id');
    table.string('razorpay_signature');
    table.text('failure_reason');
    table.timestamp('captured_at');
    table.unique(['razorpay_order_id']);
    table.index('razorpay_payment_id');
  });

  await knex.schema.alterTable('refunds', (table) => {
    table.string('gateway_refund_id');
    table.timestamp('processed_at');
    table.index('gateway_refund_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('refunds', (table) => {
    table.dropIndex('gateway_refund_id');
    table.dropColumn('gateway_refund_id');
    table.dropColumn('processed_at');
  });
  await knex.schema.alterTable('payments', (table) => {
    table.dropUnique(['razorpay_order_id']);
    table.dropIndex('razorpay_payment_id');
    table.dropColumn('gateway');
    table.dropColumn('razorpay_order_id');
    table.dropColumn('razorpay_payment_id');
    table.dropColumn('razorpay_signature');
    table.dropColumn('failure_reason');
    table.dropColumn('captured_at');
  });
  await knex.schema.alterTable('bookings', (table) => {
    table.dropUnique(['booking_ref']);
    table.dropIndex('hold_expires_at');
    table.dropForeign('cancelled_by');
    table.dropColumn('booking_ref');
    table.dropColumn('guest_name');
    table.dropColumn('guest_email');
    table.dropColumn('guest_phone');
    table.dropColumn('special_requests');
    table.dropColumn('hold_expires_at');
    table.dropColumn('cancellation_reason');
    table.dropColumn('cancelled_at');
    table.dropColumn('cancelled_by');
  });
};
