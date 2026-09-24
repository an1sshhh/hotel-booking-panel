const path = require('path');
const fs = require('fs/promises');
const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');
const { logAction } = require('../../shared/utils/audit');
const { hotelSchema, IMAGE_CATEGORIES } = require('../../schema/hotel.schema');
const { uploadDir } = require('../../middleware/upload.middleware');

/** Treats "", "undefined" and "null" as absent so a stray query param can't blank a list. */
function filterParam(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== 'undefined' && trimmed !== 'null' ? trimmed : null;
}

async function listHotels({ status, city, search }) {
  let query = db('hotels').select();

  if (status) query = query.where({ status });
  if (city) query = query.where({ city });
  if (search) {
    query = query.where((qb) => {
      qb.whereILike('name', `%${search}%`).orWhereILike('city', `%${search}%`);
    });
  }

  return query.orderBy('created_at', 'desc');
}

async function getHotelById(id) {
  const hotel = await db('hotels').where({ id }).first();
  if (!hotel) throw ApiError.notFound('Hotel not found');

  const images = await db('hotel_images').where({ hotel_id: hotel.id }).orderBy('sort_order');
  const amenities = await db('hotel_amenities')
    .join('amenities', 'amenities.id', 'hotel_amenities.amenity_id')
    .where('hotel_amenities.hotel_id', hotel.id)
    .select('amenities.id', 'amenities.name');

  return { ...hotel, images, amenities };
}

async function createHotel(body, adminUserId) {
  const data = hotelSchema(body, { requireCore: true });

  const [hotel] = await db('hotels')
    .insert({ ...data, created_by: adminUserId })
    .returning('*');

  await logAction({ adminUserId, action: 'hotel.created', entityType: 'hotel', entityId: hotel.id, after: hotel });
  return hotel;
}

async function updateHotel(id, body, adminUserId) {
  const existing = await db('hotels').where({ id }).first();
  if (!existing) throw ApiError.notFound('Hotel not found');

  const data = hotelSchema(body, { requireCore: false });
  if (!Object.keys(data).length) return existing;

  const [hotel] = await db('hotels')
    .where({ id })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');

  await logAction({ adminUserId, action: 'hotel.updated', entityType: 'hotel', entityId: hotel.id, before: existing, after: hotel });
  return hotel;
}

async function addHotelImage(hotelId, file, category) {
  const hotel = await db('hotels').where({ id: hotelId }).first();
  if (!hotel) throw ApiError.notFound('Hotel not found');

  const resolvedCategory = IMAGE_CATEGORIES.includes(category) ? category : 'other';
  const [{ maxOrder }] = await db('hotel_images').where({ hotel_id: hotelId }).max('sort_order as maxOrder');

  const [image] = await db('hotel_images')
    .insert({
      hotel_id: hotelId,
      url: `/uploads/${file.filename}`,
      category: resolvedCategory,
      sort_order: (maxOrder ?? -1) + 1,
    })
    .returning('*');

  return image;
}

async function setPrimaryImage(hotelId, imageId) {
  await db('hotel_images').where({ hotel_id: hotelId }).update({ is_primary: false });
  const [image] = await db('hotel_images')
    .where({ id: imageId, hotel_id: hotelId })
    .update({ is_primary: true })
    .returning('*');

  if (!image) throw ApiError.notFound('Image not found');
  await db('hotels').where({ id: hotelId }).update({ image_url: image.url });
  return image;
}

async function deleteImage(hotelId, imageId) {
  const [image] = await db('hotel_images').where({ id: imageId, hotel_id: hotelId }).del().returning('*');
  if (!image) throw ApiError.notFound('Image not found');

  const filename = path.basename(image.url);
  await fs.unlink(path.join(uploadDir, filename)).catch(() => {});
}

async function updateAmenities(hotelId, amenityIds) {
  if (!Array.isArray(amenityIds) || amenityIds.some((id) => !Number.isInteger(Number(id)))) {
    throw ApiError.badRequest('amenityIds must be an array of amenity ids');
  }

  await db.transaction(async (trx) => {
    await trx('hotel_amenities').where({ hotel_id: hotelId }).del();
    if (amenityIds.length) {
      await trx('hotel_amenities').insert(
        amenityIds.map((amenityId) => ({ hotel_id: hotelId, amenity_id: amenityId }))
      );
    }
  });

  return db('hotel_amenities')
    .join('amenities', 'amenities.id', 'hotel_amenities.amenity_id')
    .where('hotel_amenities.hotel_id', hotelId)
    .select('amenities.id', 'amenities.name');
}

module.exports = { filterParam, listHotels, getHotelById, createHotel, updateHotel, addHotelImage, setPrimaryImage, deleteImage, updateAmenities };
