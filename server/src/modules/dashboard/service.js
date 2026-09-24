const db = require('../../database/db');

async function getStats() {
  const [{ count: hotels }] = await db('hotels').count({ count: '*' });
  const [{ count: rooms }] = await db('room_types').count({ count: '*' });
  const [{ count: bookings }] = await db('bookings').count({ count: '*' });
  const [{ count: customers }] = await db('customers').count({ count: '*' });

  const byStatus = await db('bookings').select('booking_status').count({ count: '*' }).groupBy('booking_status');
  const countByStatus = Object.fromEntries(byStatus.map((r) => [r.booking_status, Number(r.count)]));

  const [{ revenue }] = await db('bookings')
    .whereNotIn('booking_status', ['cancelled'])
    .sum({ revenue: 'total_amount' });

  return {
    hotels: Number(hotels),
    rooms: Number(rooms),
    bookings: Number(bookings),
    customers: Number(customers),
    revenue: Number(revenue) || 0,
    pending: countByStatus.pending || 0,
    confirmed: countByStatus.confirmed || 0,
    checkedIn: countByStatus.checked_in || 0,
    checkedOut: countByStatus.checked_out || 0,
    cancelled: countByStatus.cancelled || 0,
    refunded: countByStatus.refunded || 0,
  };
}

module.exports = { getStats };
