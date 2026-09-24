const db = require('../../database/db');
const { releaseInventory } = require('../../shared/utils/availability');
const { logAction } = require('../../shared/utils/audit');
const { ApiError } = require('../../core/ApiError');
const paymentService = require('../payment/service');
const { enqueue: enqueueEmail } = require('../../shared/email/service');
const { inr } = require('../../shared/email/context');

const CANCELLABLE = ['pending', 'confirmed'];
const PAID_STATUSES = ['captured', 'partially_refunded'];

// Valid booking_status transitions an admin can trigger.
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  refunded: [],
};

async function listBookings({ status, paymentStatus, hotelId, search, from, to, page = 1, pageSize = 20 }) {
  let query = db('bookings')
    .join('hotels', 'hotels.id', 'bookings.hotel_id')
    .leftJoin('customers', 'customers.id', 'bookings.customer_id')
    .leftJoin('room_types', 'room_types.id', 'bookings.room_type_id')
    .select(
      'bookings.*',
      'hotels.name as hotel_name',
      'customers.name as customer_name',
      'customers.email as customer_email',
      'room_types.name as room_type_name'
    );

  if (status) query = query.where('bookings.booking_status', status);
  if (paymentStatus) query = query.where('bookings.payment_status', paymentStatus);
  if (hotelId) query = query.where('bookings.hotel_id', hotelId);
  if (from) query = query.where('bookings.check_in', '>=', from);
  if (to) query = query.where('bookings.check_out', '<=', to);
  if (search) {
    query = query.where((qb) => {
      qb.whereRaw('bookings.id::text ilike ?', [`%${search}%`])
        .orWhereILike('bookings.booking_ref', `%${search}%`)
        .orWhereILike('bookings.guest_name', `%${search}%`)
        .orWhereILike('customers.name', `%${search}%`);
    });
  }

  const total = await query.clone().clearSelect().count({ count: 'bookings.id' }).first();
  const bookings = await query
    .orderBy('bookings.created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { data: bookings, total: Number(total.count), page: Number(page), pageSize: Number(pageSize) };
}

async function getBookingById(id, user) {
  const booking = await db('bookings')
    .join('hotels', 'hotels.id', 'bookings.hotel_id')
    .leftJoin('customers', 'customers.id', 'bookings.customer_id')
    .leftJoin('room_types', 'room_types.id', 'bookings.room_type_id')
    .leftJoin('rate_plans', 'rate_plans.id', 'bookings.rate_plan_id')
    .where('bookings.id', id)
    .select(
      'bookings.*',
      'hotels.name as hotel_name',
      'hotels.address as hotel_address',
      'customers.name as customer_name',
      'customers.email as customer_email',
      'customers.phone as customer_phone',
      'room_types.name as room_type_name',
      'rate_plans.name as rate_plan_name'
    )
    .first();

  if (!booking) throw ApiError.notFound('Booking not found');
  if (user.role !== 'admin' && booking.customer_id !== user.customerId) {
    throw ApiError.forbidden();
  }

  const [payments, refunds] = await Promise.all([
    db('payments').where({ booking_id: booking.id }).orderBy('created_at'),
    db('refunds').where({ booking_id: booking.id }).orderBy('created_at'),
  ]);
  return { ...booking, payments: payments.map(({ razorpay_signature, ...p }) => p), refunds };
}

/**
 * What cancelling this booking right now would refund, per the rate plan's
 * cancellation slabs: the slab with the largest `days_before_checkin` the
 * guest is still ahead of wins. Non-refundable plans refund nothing; a
 * refundable plan without slabs refunds in full.
 */
async function getCancellationQuote(id) {
  const booking = await db('bookings').where({ id }).first();
  if (!booking) throw ApiError.notFound('Booking not found');

  const [ratePlan, slabs, payments] = await Promise.all([
    booking.rate_plan_id ? db('rate_plans').where({ id: booking.rate_plan_id }).first() : null,
    booking.rate_plan_id
      ? db('cancellation_policies').where({ rate_plan_id: booking.rate_plan_id }).orderBy('days_before_checkin', 'desc')
      : [],
    db('payments').where({ booking_id: id }).whereIn('status', PAID_STATUSES),
  ]);

  const today = new Date(new Date().toISOString().slice(0, 10));
  const daysBeforeCheckIn = Math.floor((new Date(booking.check_in) - today) / 86400000);

  let refundPercent = 100;
  let rule = 'Refundable rate with no cancellation slabs — full refund';
  if (ratePlan && !ratePlan.refundable) {
    refundPercent = 0;
    rule = 'Non-refundable rate plan';
  } else if (slabs.length) {
    const slab = slabs.find((s) => daysBeforeCheckIn >= s.days_before_checkin);
    refundPercent = slab ? slab.refund_percent : 0;
    rule = slab
      ? `Cancelled ${daysBeforeCheckIn} day(s) before check-in — ${slab.refund_percent}% refund slab (≥ ${slab.days_before_checkin} days)`
      : `Cancelled ${daysBeforeCheckIn} day(s) before check-in — past every refund slab`;
  }

  let refundable = 0;
  const refundablePayments = [];
  for (const payment of payments) {
    const balance = await paymentService.refundableBalance(db, payment);
    if (balance > 0) {
      refundable += balance;
      refundablePayments.push({ id: payment.id, balance, gateway: payment.gateway, razorpay_payment_id: payment.razorpay_payment_id });
    }
  }
  refundable = Math.round(refundable * 100) / 100;
  const suggestedRefund = Math.min(refundable, Math.round(Number(booking.total_amount) * refundPercent) / 100);

  return {
    bookingId: booking.id,
    canCancel: CANCELLABLE.includes(booking.booking_status),
    daysBeforeCheckIn,
    refundPercent,
    rule,
    slabs,
    paidAmount: refundable,
    suggestedRefund: Math.round(suggestedRefund * 100) / 100,
    refundablePayments,
  };
}

/**
 * Admin cancellation: releases the rooms, records who/why, and refunds
 * `refundAmount` (defaults to the policy suggestion) across the booking's
 * captured payments — through Razorpay for online payments. All-or-nothing:
 * if the gateway rejects the refund, the booking stays as it was.
 */
async function cancelBooking(id, { reason, refundAmount }, adminUserId) {
  const quote = await getCancellationQuote(id);
  if (!quote.canCancel) throw ApiError.badRequest('Only pending or confirmed bookings can be cancelled');
  if (!reason || !String(reason).trim()) throw ApiError.badRequest('Please give a cancellation reason');

  const amount = refundAmount === undefined || refundAmount === null || refundAmount === ''
    ? quote.suggestedRefund
    : Math.round(Number(refundAmount) * 100) / 100;
  if (!(amount >= 0)) throw ApiError.badRequest('Refund amount must be zero or more');
  if (amount > quote.paidAmount) throw ApiError.badRequest(`At most ₹${quote.paidAmount} was paid and can be refunded`);

  const refunds = [];
  let previousStatus = null;
  const updated = await db.transaction(async (trx) => {
    const booking = await trx('bookings').where({ id }).forUpdate().first();
    previousStatus = booking.booking_status;
    if (!CANCELLABLE.includes(booking.booking_status)) throw ApiError.conflict('Booking status changed — reload and try again');

    await releaseInventory(trx, booking.room_type_id, booking.check_in, booking.check_out, booking.num_rooms);
    await trx('coupon_usages').where({ booking_id: id }).del();

    let remaining = amount;
    for (const payment of quote.refundablePayments) {
      if (remaining <= 0) break;
      const portion = Math.min(remaining, payment.balance);
      refunds.push(await paymentService.createRefund(payment.id, { amount: portion, reason: `Cancellation: ${reason}` }, adminUserId, trx));
      remaining = Math.round((remaining - portion) * 100) / 100;
    }

    const [row] = await trx('bookings')
      .where({ id })
      .update({
        booking_status: 'cancelled',
        cancellation_reason: String(reason).trim(),
        cancelled_at: trx.fn.now(),
        cancelled_by: adminUserId ?? null,
        hold_expires_at: null,
      })
      .returning('*');

    const customer = row.guest_email ? null : await trx('customers').where({ id: row.customer_id }).select('email').first();
    await enqueueEmail(trx, {
      templateKey: 'booking_cancelled',
      to: row.guest_email || customer?.email,
      data: { bookingId: row.id, refund_amount: inr(amount), has_refund: amount > 0 ? 'yes' : '' },
      entityType: 'booking',
      entityId: row.id,
    });
    return row;
  });

  await logAction({
    adminUserId, action: 'booking.cancelled', entityType: 'booking', entityId: id,
    before: { booking_status: previousStatus }, after: { booking_status: 'cancelled', reason, refundAmount: amount },
  });
  return { booking: updated, refunds, refundAmount: amount };
}

async function updateBookingStatus(id, status, adminUserId) {
  const booking = await db('bookings').where({ id }).first();
  if (!booking) throw ApiError.notFound('Booking not found');

  const allowed = ALLOWED_TRANSITIONS[booking.booking_status] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(`Cannot move booking from ${booking.booking_status} to ${status}`);
  }

  const updated = await db.transaction(async (trx) => {
    if (status === 'cancelled') {
      if (PAID_STATUSES.includes(booking.payment_status)) {
        throw ApiError.badRequest('This booking has been paid — use Cancel & refund so the guest gets their money back');
      }
      await releaseInventory(trx, booking.room_type_id, booking.check_in, booking.check_out, booking.num_rooms);
    }
    const [row] = await trx('bookings').where({ id }).update({ booking_status: status }).returning('*');
    return row;
  });

  await logAction({
    adminUserId, action: `booking.${status}`, entityType: 'booking', entityId: booking.id,
    before: { booking_status: booking.booking_status }, after: { booking_status: status },
  });

  return updated;
}

module.exports = { listBookings, getBookingById, updateBookingStatus, getCancellationQuote, cancelBooking };
