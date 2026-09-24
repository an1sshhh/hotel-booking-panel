const db = require('../../database/db');
const config = require('../../config');

const MEALS = {
  no_meals: 'Room only', breakfast: 'Breakfast included', lunch: 'Lunch included', dinner: 'Dinner included',
  breakfast_lunch: 'Breakfast + lunch', breakfast_dinner: 'Breakfast + dinner', all_meals: 'All meals included',
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const titleCase = (s) => String(s || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function time12(value, fallback) {
  if (!value) return fallback;
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h)) return value;
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Same wording as the website's checkout/voucher. */
function cancellationSummary(refundable, slabs, checkIn) {
  if (!refundable) return 'Non-refundable';
  if (!slabs.length) return 'Free cancellation until check-in';
  const full = slabs.filter((s) => s.refund_percent >= 100).sort((a, b) => a.days_before_checkin - b.days_before_checkin)[0];
  if (!full) return 'Partially refundable — see your voucher for details';
  const deadline = addDays(checkIn, -full.days_before_checkin);
  return `Free cancellation till ${day(deadline).replace(/^\w+, /, '')}`;
}

/**
 * Everything a booking email can mention, formatted for display. Loaded at
 * send time, so emails always reflect the booking's current state.
 */
async function bookingContext(bookingId) {
  const b = await db('bookings')
    .join('hotels', 'hotels.id', 'bookings.hotel_id')
    .leftJoin('customers', 'customers.id', 'bookings.customer_id')
    .leftJoin('room_types', 'room_types.id', 'bookings.room_type_id')
    .leftJoin('rate_plans', 'rate_plans.id', 'bookings.rate_plan_id')
    .leftJoin('coupons', 'coupons.id', 'bookings.coupon_id')
    .where('bookings.id', bookingId)
    .select(
      'bookings.*',
      'hotels.name as hotel_name', 'hotels.address as hotel_address', 'hotels.city as hotel_city', 'hotels.state as hotel_state',
      'hotels.pincode as hotel_pincode', 'hotels.phone as hotel_phone', 'hotels.check_in_time', 'hotels.check_out_time',
      'hotels.latitude', 'hotels.longitude',
      'customers.name as customer_name', 'customers.email as customer_email', 'customers.phone as customer_phone',
      'room_types.name as room_type_name', 'rate_plans.name as rate_plan_name', 'rate_plans.meal_inclusion', 'rate_plans.refundable',
      'coupons.code as coupon_code'
    )
    .first();
  if (!b) return null;

  const [slabs, payment] = await Promise.all([
    b.rate_plan_id ? db('cancellation_policies').where({ rate_plan_id: b.rate_plan_id }) : [],
    db('payments').where({ booking_id: b.id }).whereIn('status', ['captured', 'partially_refunded', 'refunded']).orderBy('captured_at', 'desc').first(),
  ]);

  const phone = b.guest_phone || b.customer_phone;
  return {
    booking_id: b.id,
    booking_ref: b.booking_ref,
    guest_name: b.guest_name || b.customer_name || 'Guest',
    guest_email: b.guest_email || b.customer_email || '',
    guest_phone: phone ? (/^\d{10}$/.test(phone) ? `+91 ${phone}` : phone) : '',
    hotel_name: b.hotel_name,
    hotel_address: [b.hotel_address, b.hotel_city, b.hotel_state, b.hotel_pincode].filter(Boolean).join(', '),
    hotel_phone: b.hotel_phone || '',
    room_summary: `${b.num_rooms} × ${b.room_type_name || 'Room'}`,
    rate_plan: b.rate_plan_name || '',
    meal_plan: MEALS[b.meal_inclusion] || 'Room only',
    check_in: day(b.check_in),
    check_in_time: time12(b.check_in_time, '2:00 PM'),
    check_out: day(b.check_out),
    check_out_time: time12(b.check_out_time, '12:00 PM'),
    nights: String(b.nights),
    guests: String(b.guests),
    room_price: inr(b.room_price),
    taxes: inr(b.tax_amount),
    fees: inr(b.fee_amount),
    has_fees: Number(b.fee_amount) > 0 ? 'yes' : '',
    discount: inr(b.discount_amount),
    has_discount: Number(b.discount_amount) > 0 ? 'yes' : '',
    coupon_code: b.coupon_code || '',
    total: inr(b.total_amount),
    payment_method: payment?.method ? titleCase(payment.method).replace('Upi', 'UPI') : 'Online payment',
    payment_id: payment?.razorpay_payment_id || '',
    special_requests: b.special_requests || '',
    cancellation_policy: cancellationSummary(b.refundable, slabs, b.check_in),
    cancellation_reason: b.cancellation_reason || '',
    voucher_url: `${config.email.siteUrl}/bookings/${b.id}`,
    rebook_url: `${config.email.siteUrl}/hotels/${b.hotel_id}?checkIn=${b.check_in}&checkOut=${b.check_out}&rooms=${b.num_rooms}&adults=${b.guests}&guests=${b.guests}`,
    map_url: b.latitude && b.longitude ? `https://www.google.com/maps?q=${b.latitude},${b.longitude}` : '',
    admin_booking_url: `${config.email.adminUrl}/bookings/${b.id}`,
  };
}

module.exports = { bookingContext, inr };
