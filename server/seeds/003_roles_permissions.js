const PERMISSIONS = [
  'hotels.view', 'hotels.create', 'hotels.edit', 'hotels.delete',
  'bookings.view', 'bookings.edit', 'bookings.cancel',
  'customers.view', 'customers.edit',
  'payments.view', 'payments.refund',
  'coupons.view', 'coupons.manage',
  'reviews.view', 'reviews.moderate',
  'reports.view',
  'settings.manage',
  'admin_users.manage',
];

const ROLES = {
  'Super Admin': PERMISSIONS,
  'Hotel Manager': ['hotels.view', 'hotels.create', 'hotels.edit', 'hotels.delete', 'bookings.view', 'bookings.edit'],
  'Booking Manager': ['bookings.view', 'bookings.edit', 'bookings.cancel', 'customers.view'],
  'Finance Admin': ['payments.view', 'payments.refund', 'reports.view'],
  'Support Agent': ['customers.view', 'bookings.view', 'reviews.view', 'reviews.moderate'],
};

exports.seed = async function (knex) {
  await knex('role_permissions').del();
  await knex('permissions').del();
  await knex('roles').del();

  const permissionRows = await knex('permissions')
    .insert(PERMISSIONS.map((key) => ({ key })))
    .returning(['id', 'key']);

  const permissionIdByKey = Object.fromEntries(permissionRows.map((p) => [p.key, p.id]));

  for (const [roleName, keys] of Object.entries(ROLES)) {
    const [role] = await knex('roles').insert({ name: roleName }).returning(['id']);
    await knex('role_permissions').insert(
      keys.map((key) => ({ role_id: role.id, permission_id: permissionIdByKey[key] }))
    );
  }

  const superAdmin = await knex('roles').where({ name: 'Super Admin' }).first();
  await knex('users').where({ email: 'admin@example.com' }).update({ role_id: superAdmin.id });
};
