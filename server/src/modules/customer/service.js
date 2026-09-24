const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');
const { customerCreateSchema } = require('../../schema/customer.schema');

async function createCustomer(body) {
  const data = customerCreateSchema(body);

  if (!data.name || !data.email) {
    throw ApiError.badRequest('Name and email are required');
  }

  const [customer] = await db('customers').insert(data).returning('*');
  return customer;
}

async function listCustomers({ search, page = 1, pageSize = 20 }) {
  let query = db('customers').select();

  if (search) {
    query = query.where((qb) => {
      qb.whereILike('name', `%${search}%`).orWhereILike('email', `%${search}%`).orWhereILike('phone', `%${search}%`);
    });
  }

  const total = await query.clone().count({ count: '*' }).first();
  const customers = await query
    .orderBy('created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const ids = customers.map((c) => c.id);
  const stats = ids.length
    ? await db('bookings')
        .whereIn('customer_id', ids)
        .groupBy('customer_id')
        .select(
          'customer_id',
          db.raw('count(*) as total_bookings'),
          db.raw('coalesce(sum(total_amount), 0) as total_spent'),
          db.raw('max(created_at) as last_booking')
        )
    : [];
  const statsByCustomer = Object.fromEntries(stats.map(({ customer_id, ...rest }) => [customer_id, rest]));

  const withStats = customers.map((customer) => ({
    ...customer,
    ...(statsByCustomer[customer.id] || { total_bookings: 0, total_spent: 0, last_booking: null }),
  }));

  return { data: withStats, total: Number(total.count), page: Number(page), pageSize: Number(pageSize) };
}

async function getCustomerById(id) {
  const customer = await db('customers').where({ id }).first();
  if (!customer) throw ApiError.notFound('Customer not found');

  const bookings = await db('bookings')
    .where({ customer_id: customer.id })
    .join('hotels', 'hotels.id', 'bookings.hotel_id')
    .select('bookings.*', 'hotels.name as hotel_name')
    .orderBy('bookings.created_at', 'desc');

  return { ...customer, bookings };
}

async function updateCustomerStatus(id, status) {
  if (!['active', 'blocked'].includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  const [customer] = await db('customers').where({ id }).update({ status }).returning('*');
  if (!customer) throw ApiError.notFound('Customer not found');
  return customer;
}

module.exports = { createCustomer, listCustomers, getCustomerById, updateCustomerStatus };
