const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');

async function listAmenities(scope) {
  let query = db('amenities').select();
  if (scope) query = query.whereIn('scope', [scope, 'both']);
  return query.orderBy('name');
}

async function createAmenity({ name, scope = 'both' }) {
  if (!name) throw ApiError.badRequest('Amenity name is required');

  const [amenity] = await db('amenities')
    .insert({ name, scope, is_custom: true })
    .onConflict(['name', 'scope'])
    .merge()
    .returning('*');

  return amenity;
}

module.exports = { listAmenities, createAmenity };
