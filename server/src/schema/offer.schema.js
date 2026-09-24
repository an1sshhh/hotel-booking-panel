const { validate } = require('../shared/utils/validator');
const { ApiError } = require('../core/ApiError');

const OFFER_THEMES = ['beach', 'mountains', 'city', 'heritage', 'forest', 'festive'];

/**
 * Offer payload (camelCase in, snake_case columns out). Partial on update.
 * The CTA link must be an on-site path so an offer can never send guests to
 * an arbitrary external site.
 */
function offerSchema(body, { requireCore }) {
  const input = body ?? {};
  const out = validate(input)
    .string('title', { required: requireCore, max: 120, label: 'Title' })
    .string('subtitle', { max: 300, label: 'Subtitle' })
    .string('badge', { max: 40, label: 'Badge' })
    .string('terms', { max: 2000, label: 'Terms' })
    .number('couponId', { integer: true, min: 1, label: 'Coupon' })
    .enum('theme', OFFER_THEMES, { label: 'Artwork theme' })
    .string('ctaLabel', { max: 40, label: 'Button label' })
    .string('ctaUrl', { max: 255, label: 'Button link' })
    .boolean('isActive')
    .boolean('showAtCheckout')
    .number('sortOrder', { integer: true, min: 0, max: 9999, label: 'Sort order' })
    .result();

  const errors = [];
  if (out.ctaUrl && (!out.ctaUrl.startsWith('/') || out.ctaUrl.startsWith('//'))) {
    errors.push({ field: 'ctaUrl', message: 'Button link must be a page on the website, e.g. /hotels?city=Goa' });
  }
  for (const field of ['validFrom', 'validUntil']) {
    if (input[field] === undefined) continue;
    if (input[field] === null || input[field] === '') out[field] = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input[field]))) errors.push({ field, message: 'Dates must be YYYY-MM-DD' });
    else out[field] = String(input[field]);
  }
  if (out.validFrom && out.validUntil && out.validUntil < out.validFrom) {
    errors.push({ field: 'validUntil', message: 'End date must be on or after the start date' });
  }
  if (errors.length) throw ApiError.badRequest(errors[0].message, errors);

  const columns = {
    title: 'title', subtitle: 'subtitle', badge: 'badge', terms: 'terms', couponId: 'coupon_id', theme: 'theme',
    ctaLabel: 'cta_label', ctaUrl: 'cta_url', validFrom: 'valid_from', validUntil: 'valid_until',
    isActive: 'is_active', showAtCheckout: 'show_at_checkout', sortOrder: 'sort_order',
  };
  const data = {};
  for (const [key, column] of Object.entries(columns)) if (out[key] !== undefined) data[column] = out[key];
  return data;
}

module.exports = { offerSchema };
