const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');

async function createRatePlan(roomTypeId, body) {
  const { name, price, meal_inclusion, refundable, inclusions = [], cancellationSlabs = [] } = body;

  if (!name || price === undefined) {
    throw ApiError.badRequest('Rate plan name and price are required');
  }
  if (Number(price) < 0) {
    throw ApiError.badRequest('Price must be >= 0');
  }

  return db.transaction(async (trx) => {
    const [plan] = await trx('rate_plans')
      .insert({
        room_type_id: roomTypeId,
        name,
        price,
        meal_inclusion: meal_inclusion || 'no_meals',
        refundable: refundable ?? true,
      })
      .returning('*');

    if (inclusions.length) {
      await trx('rate_plan_inclusions').insert(
        inclusions.map((label) => ({ rate_plan_id: plan.id, label }))
      );
    }

    if (cancellationSlabs.length) {
      await trx('cancellation_policies').insert(
        cancellationSlabs.map((slab, index) => ({
          rate_plan_id: plan.id,
          days_before_checkin: slab.daysBeforeCheckin,
          refund_percent: slab.refundPercent,
          sort_order: index,
        }))
      );
    }

    return plan;
  });
}

module.exports = { createRatePlan };
