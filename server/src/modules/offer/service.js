const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');
const { logAction } = require('../../shared/utils/audit');
const { offerSchema } = require('../../schema/offer.schema');

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Where an offer stands on the guest site right now. Mirrors the public
 * filter in web/server, so what the admin sees as "Live" is exactly what
 * guests see.
 */
function liveStatus(offer) {
  const now = today();
  if (!offer.is_active) return { key: 'hidden', label: 'Hidden' };
  if (offer.valid_from && now < offer.valid_from) return { key: 'scheduled', label: 'Scheduled' };
  if (offer.valid_until && now > offer.valid_until) return { key: 'expired', label: 'Expired' };
  if (offer.coupon_id && (!offer.coupon_active || now < offer.coupon_valid_from || now > offer.coupon_valid_until)) {
    return { key: 'coupon_unavailable', label: 'Coupon not live' };
  }
  return { key: 'live', label: 'Live' };
}

function baseQuery() {
  return db('offers')
    .leftJoin('coupons', 'coupons.id', 'offers.coupon_id')
    .select(
      'offers.*',
      'coupons.code as coupon_code',
      'coupons.discount_type as coupon_discount_type',
      'coupons.discount_value as coupon_discount_value',
      'coupons.min_booking_amount as coupon_min_booking_amount',
      'coupons.max_discount as coupon_max_discount',
      'coupons.active as coupon_active',
      'coupons.valid_from as coupon_valid_from',
      'coupons.valid_until as coupon_valid_until'
    );
}

const withStatus = (offer) => ({ ...offer, status: liveStatus(offer) });

async function listOffers() {
  const rows = await baseQuery().orderBy([{ column: 'offers.sort_order' }, { column: 'offers.created_at', order: 'desc' }]);
  return rows.map(withStatus);
}

async function getOffer(id) {
  const offer = await baseQuery().where('offers.id', id).first();
  if (!offer) throw ApiError.notFound('Offer not found');
  return withStatus(offer);
}

async function assertCoupon(couponId) {
  if (!couponId) return;
  const coupon = await db('coupons').where({ id: couponId }).first();
  if (!coupon) throw ApiError.badRequest('Selected coupon does not exist');
}

async function createOffer(body, adminUserId) {
  const data = offerSchema(body, { requireCore: true });
  await assertCoupon(data.coupon_id);
  const [row] = await db('offers').insert({ ...data, created_by: adminUserId ?? null }).returning('*');
  await logAction({ adminUserId, action: 'offer.created', entityType: 'offer', entityId: row.id, after: row });
  return getOffer(row.id);
}

async function updateOffer(id, body, adminUserId) {
  const existing = await db('offers').where({ id }).first();
  if (!existing) throw ApiError.notFound('Offer not found');
  const data = offerSchema(body, { requireCore: false });
  if (data.coupon_id !== undefined) await assertCoupon(data.coupon_id);
  if (Object.keys(data).length) {
    await db('offers').where({ id }).update({ ...data, updated_at: db.fn.now() });
    await logAction({ adminUserId, action: 'offer.updated', entityType: 'offer', entityId: id, before: existing, after: data });
  }
  return getOffer(id);
}

async function deleteOffer(id, adminUserId) {
  const existing = await db('offers').where({ id }).first();
  if (!existing) throw ApiError.notFound('Offer not found');
  await db('offers').where({ id }).del();
  await logAction({ adminUserId, action: 'offer.deleted', entityType: 'offer', entityId: id, before: existing });
}

async function setOfferImage(id, file, adminUserId) {
  if (!file) throw ApiError.badRequest('Image file is required');
  const existing = await db('offers').where({ id }).first();
  if (!existing) throw ApiError.notFound('Offer not found');
  await db('offers').where({ id }).update({ image_url: `/uploads/${file.filename}`, updated_at: db.fn.now() });
  await logAction({ adminUserId, action: 'offer.image_updated', entityType: 'offer', entityId: id });
  return getOffer(id);
}

async function removeOfferImage(id, adminUserId) {
  const existing = await db('offers').where({ id }).first();
  if (!existing) throw ApiError.notFound('Offer not found');
  await db('offers').where({ id }).update({ image_url: null, updated_at: db.fn.now() });
  await logAction({ adminUserId, action: 'offer.image_removed', entityType: 'offer', entityId: id });
  return getOffer(id);
}

module.exports = { listOffers, createOffer, updateOffer, deleteOffer, setOfferImage, removeOfferImage };
