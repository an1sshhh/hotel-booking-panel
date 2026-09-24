const Razorpay = require('razorpay');
const config = require('../../config');
const { ApiError } = require('../../core/ApiError');

let client = null;

function isConfigured() {
  return Boolean(config.razorpay.keyId && config.razorpay.keySecret);
}

function getClient() {
  if (!isConfigured()) {
    throw ApiError.unavailable('Razorpay keys are not configured on the admin server, so online refunds cannot be issued.');
  }
  if (!client) {
    client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  }
  return client;
}

/**
 * Issues a refund against a captured Razorpay payment. Returns the gateway
 * refund id and our refund status ('completed' once Razorpay reports it
 * processed, otherwise 'processing' until the refund.processed webhook).
 */
async function refundPayment(paymentId, amountRupees, notes = {}) {
  try {
    const refund = await getClient().payments.refund(paymentId, {
      amount: Math.round(Number(amountRupees) * 100),
      speed: 'normal',
      notes,
    });
    return { gatewayRefundId: refund.id, status: refund.status === 'processed' ? 'completed' : 'processing' };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const reason = err?.error?.description || err.message || 'unknown error';
    throw ApiError.unavailable(`Razorpay refused the refund: ${reason}`, 502);
  }
}

module.exports = { refundPayment };
