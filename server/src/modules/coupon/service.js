const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');

async function listCoupons(active) {
  let query = db('coupons').select();
  if (active !== undefined) query = query.where({ active: active === 'true' });
  return query.orderBy('created_at', 'desc');
}

async function createCoupon(body) {
  const {
    code, discountType, discountValue, minBookingAmount = 0, maxDiscount, validFrom, validUntil,
    usageLimit, perCustomerLimit, hotelIds = [], roomTypeIds = [], ratePlanIds = [],
  } = body;

  if (!code || !discountType || discountValue === undefined || !validFrom || !validUntil) {
    throw ApiError.badRequest('code, discountType, discountValue, validFrom and validUntil are required');
  }
  if (Number(discountValue) < 0 || (maxDiscount !== undefined && maxDiscount !== null && Number(maxDiscount) < 0)) {
    throw ApiError.badRequest('Discount values cannot be negative');
  }
  if (new Date(validUntil) < new Date(validFrom)) {
    throw ApiError.badRequest('validUntil must be after validFrom');
  }

  return db.transaction(async (trx) => {
    const [row] = await trx('coupons')
      .insert({
        code: code.toUpperCase(),
        discount_type: discountType,
        discount_value: discountValue,
        min_booking_amount: minBookingAmount,
        max_discount: maxDiscount ?? null,
        valid_from: validFrom,
        valid_until: validUntil,
        usage_limit: usageLimit ?? null,
        per_customer_limit: perCustomerLimit ?? null,
      })
      .returning('*');

    if (hotelIds.length) await trx('coupon_hotels').insert(hotelIds.map((hotel_id) => ({ coupon_id: row.id, hotel_id })));
    if (roomTypeIds.length) await trx('coupon_room_types').insert(roomTypeIds.map((room_type_id) => ({ coupon_id: row.id, room_type_id })));
    if (ratePlanIds.length) await trx('coupon_rate_plans').insert(ratePlanIds.map((rate_plan_id) => ({ coupon_id: row.id, rate_plan_id })));

    return row;
  });
}

async function updateCoupon(id, body) {
  const existing = await db('coupons').where({ id }).first();
  if (!existing) throw ApiError.notFound('Coupon not found');

  const { active, discountValue, maxDiscount } = body;
  if (discountValue !== undefined && Number(discountValue) < 0) {
    throw ApiError.badRequest('Discount value cannot be negative');
  }
  if (maxDiscount !== undefined && maxDiscount !== null && Number(maxDiscount) < 0) {
    throw ApiError.badRequest('Max discount cannot be negative');
  }

  const [coupon] = await db('coupons')
    .where({ id })
    .update({
      active: active ?? existing.active,
      discount_value: discountValue ?? existing.discount_value,
      max_discount: maxDiscount !== undefined ? maxDiscount : existing.max_discount,
    })
    .returning('*');

  return coupon;
}

async function deleteCoupon(id) {
  const usageCount = await db('coupon_usages').where({ coupon_id: id }).count({ count: '*' }).first();
  if (Number(usageCount.count) > 0) {
    // Never hard-delete a coupon with usage history; deactivate instead.
    await db('coupons').where({ id }).update({ active: false });
    return { deactivated: true, message: 'Coupon has usage history; deactivated instead of deleted' };
  }

  const deleted = await db('coupons').where({ id }).del();
  if (!deleted) throw ApiError.notFound('Coupon not found');
  return { deactivated: false };
}

module.exports = { listCoupons, createCoupon, updateCoupon, deleteCoupon };
