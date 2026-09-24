const { validate } = require('../shared/utils/validator');

const HOTEL_TYPES = ['hotel', 'resort', 'villa', 'hostel', 'apartment', 'other'];
const HOTEL_STATUSES = ['draft', 'active', 'inactive', 'suspended'];

/**
 * Validates and normalises a hotel payload. `requireCore` is on for creates so
 * name/city must be present; updates stay partial.
 */
function hotelSchema(body, { requireCore }) {
  return validate(body)
    .string('name', { required: requireCore, max: 200, label: 'Hotel name' })
    .string('description', { max: 2000, label: 'Description' })
    .string('city', { required: requireCore, max: 120, label: 'City' })
    .string('state', { max: 120, label: 'State' })
    .string('country', { max: 120, label: 'Country' })
    .pincode('pincode', { label: 'Pincode' })
    .string('address', { required: requireCore, max: 400, label: 'Address' })
    .phone('phone', { label: 'Phone' })
    .url('website', { label: 'Website' })
    .string('policy_notes', { max: 2000, label: 'Policy notes' })
    .email('email', { label: 'Email' })
    .enum('hotel_type', HOTEL_TYPES, { label: 'Hotel type' })
    .enum('status', HOTEL_STATUSES, { label: 'Status' })
    .number('star_category', { min: 1, max: 5, integer: true, label: 'Star category' })
    .number('latitude', { min: -90, max: 90, label: 'Latitude' })
    .number('longitude', { min: -180, max: 180, label: 'Longitude' })
    .time('check_in_time', { label: 'Check-in time' })
    .time('check_out_time', { label: 'Check-out time' })
    .boolean('early_checkin_available')
    .boolean('late_checkout_available')
    .boolean('pets_allowed')
    .boolean('smoking_allowed')
    .boolean('children_allowed')
    .result();
}

const IMAGE_CATEGORIES = ['exterior', 'lobby', 'rooms', 'bathroom', 'pool', 'restaurant', 'facilities', 'other'];

module.exports = { hotelSchema, IMAGE_CATEGORIES };
