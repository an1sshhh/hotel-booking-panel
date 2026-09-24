const HOTEL_AMENITIES = [
  'Wi-Fi', 'Swimming Pool', 'Parking', 'Restaurant', 'Room Service',
  'Air Conditioning', 'Gym', 'Spa', 'Laundry', 'Housekeeping',
  'In-room Dining', 'Iron/Ironing Board', 'Indoor Games', 'Airport Transfer', '24/7 Front Desk',
];

const ROOM_AMENITIES = [
  'Wi-Fi', 'Air Conditioning', 'Housekeeping', 'Room Service', 'In-room Dining',
  'Iron/Ironing Board', 'Mineral Water', 'TV', 'Mini Bar', 'Balcony', 'Bathtub',
];

exports.seed = async function (knex) {
  await knex('amenities').del();

  const rows = [
    ...HOTEL_AMENITIES.map((name) => ({ name, scope: 'hotel', is_custom: false })),
    ...ROOM_AMENITIES.map((name) => ({ name, scope: 'room', is_custom: false })),
  ];

  await knex('amenities').insert(rows);
};
