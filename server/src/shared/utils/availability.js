function dateRange(checkIn, checkOut) {
  // Work entirely in UTC to avoid local-timezone day shifts.
  const dates = [];
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function releaseInventory(trx, roomTypeId, checkIn, checkOut, numRooms) {
  const dates = dateRange(checkIn, checkOut);
  await trx('room_inventory')
    .where({ room_type_id: roomTypeId })
    .whereIn('date', dates)
    .decrement('booked', numRooms);
}

module.exports = { releaseInventory };
