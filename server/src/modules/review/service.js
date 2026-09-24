const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');

async function recalculateHotelRating(hotelId) {
  const stats = await db('reviews')
    .where({ hotel_id: hotelId, status: 'published' })
    .select(db.raw('coalesce(avg(rating), 0) as avg_rating'), db.raw('count(*) as count'))
    .first();

  await db('hotels')
    .where({ id: hotelId })
    .update({ rating: Number(stats.avg_rating).toFixed(1), reviews_count: Number(stats.count) });
}

async function listReviews({ status, hotelId, rating }) {
  let query = db('reviews')
    .join('hotels', 'hotels.id', 'reviews.hotel_id')
    .leftJoin('customers', 'customers.id', 'reviews.customer_id')
    .select('reviews.*', 'hotels.name as hotel_name', 'customers.name as customer_name');

  if (status) query = query.where('reviews.status', status);
  if (hotelId) query = query.where('reviews.hotel_id', hotelId);
  if (rating) query = query.where('reviews.rating', rating);

  return query.orderBy('reviews.created_at', 'desc');
}

async function approveReview(id) {
  const [review] = await db('reviews').where({ id }).update({ status: 'published' }).returning('*');
  if (!review) throw ApiError.notFound('Review not found');
  await recalculateHotelRating(review.hotel_id);
  return review;
}

async function hideReview(id) {
  const [review] = await db('reviews').where({ id }).update({ status: 'hidden' }).returning('*');
  if (!review) throw ApiError.notFound('Review not found');
  await recalculateHotelRating(review.hotel_id);
  return review;
}

async function deleteReview(id) {
  const review = await db('reviews').where({ id }).first();
  if (!review) throw ApiError.notFound('Review not found');
  await db('reviews').where({ id }).del();
  await recalculateHotelRating(review.hotel_id);
}

module.exports = { listReviews, approveReview, hideReview, deleteReview };
