const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');
const { logAction } = require('../../shared/utils/audit');
const { refundPayment } = require('../../shared/utils/razorpay');
const { enqueue: enqueueEmail } = require('../../shared/email/service');
const { inr } = require('../../shared/email/context');

async function listPayments(status) {
  let query = db('payments')
    .join('bookings', 'bookings.id', 'payments.booking_id')
    .leftJoin('customers', 'customers.id', 'payments.customer_id')
    .leftJoin('hotels', 'hotels.id', 'bookings.hotel_id')
    .select('payments.*', 'customers.name as customer_name', 'hotels.name as hotel_name');

  if (status) query = query.where('payments.status', status);
  return query.orderBy('payments.created_at', 'desc');
}

async function getPaymentById(id) {
  const payment = await db('payments').where({ id }).first();
  if (!payment) throw ApiError.notFound('Payment not found');
  const refunds = await db('refunds').where({ payment_id: payment.id });
  return { ...payment, refunds };
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Money actually received on a payment minus refunds that haven't failed. */
async function refundableBalance(trx, payment) {
  const [{ total }] = await trx('refunds').where({ payment_id: payment.id }).whereNot({ status: 'failed' }).sum('amount as total');
  return round2(Number(payment.amount) - Number(total || 0));
}

/**
 * Refunds part or all of a captured payment. Razorpay payments are refunded
 * through the gateway (the webhook later marks them completed); offline
 * payments just record the refund for accounting. Runs under a row lock on
 * the payment so two admins can't refund the same money twice.
 */
async function createRefund(paymentId, { amount, reason }, adminUserId, outerTrx) {
  const refundAmount = round2(amount);
  if (!(refundAmount > 0)) throw ApiError.badRequest('Refund amount must be greater than zero');

  const run = async (trx) => {
    const payment = await trx('payments').where({ id: paymentId }).forUpdate().first();
    if (!payment) throw ApiError.notFound('Payment not found');
    if (!['captured', 'partially_refunded'].includes(payment.status)) {
      throw ApiError.badRequest('Only captured payments can be refunded');
    }

    const balance = await refundableBalance(trx, payment);
    if (refundAmount > balance) throw ApiError.badRequest(`At most ₹${balance} can still be refunded on this payment`);

    let gateway = { gatewayRefundId: null, status: 'completed' };
    if (payment.razorpay_payment_id) {
      const booking = await trx('bookings').where({ id: payment.booking_id }).select('booking_ref').first();
      gateway = await refundPayment(payment.razorpay_payment_id, refundAmount, {
        booking_ref: booking?.booking_ref ?? '', reason: String(reason || '').slice(0, 200),
      });
    }

    const [row] = await trx('refunds')
      .insert({
        payment_id: payment.id,
        booking_id: payment.booking_id,
        amount: refundAmount,
        reason,
        status: gateway.status,
        gateway_refund_id: gateway.gatewayRefundId,
        processed_at: gateway.status === 'completed' ? trx.fn.now() : null,
      })
      .returning('*');

    // Offline refunds are complete immediately; Razorpay ones email the guest from the refund.processed webhook.
    if (row.status === 'completed') {
      const booking = await trx('bookings')
        .leftJoin('customers', 'customers.id', 'bookings.customer_id')
        .where('bookings.id', payment.booking_id)
        .select(trx.raw('coalesce(bookings.guest_email, customers.email) as email'))
        .first();
      await enqueueEmail(trx, {
        templateKey: 'refund_processed',
        to: booking?.email,
        data: { bookingId: payment.booking_id, refund_amount: inr(refundAmount), refund_id: `Refund #${row.id}` },
        entityType: 'booking',
        entityId: payment.booking_id,
      });
    }

    const paymentStatus = refundAmount >= balance ? 'refunded' : 'partially_refunded';
    await trx('payments').where({ id: payment.id }).update({ status: paymentStatus, updated_at: trx.fn.now() });
    await trx('bookings').where({ id: payment.booking_id }).update({ payment_status: paymentStatus });
    return row;
  };

  const refund = outerTrx ? await run(outerTrx) : await db.transaction(run);
  if (!outerTrx) {
    await logAction({ adminUserId, action: 'payment.refunded', entityType: 'payment', entityId: paymentId, after: refund });
  }
  return refund;
}

module.exports = { listPayments, getPaymentById, createRefund, refundableBalance };
