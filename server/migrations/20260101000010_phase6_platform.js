exports.up = async function (knex) {
  await knex.schema.createTable('roles', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.string('description');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('permissions', (table) => {
    table.increments('id').primary();
    table.string('key').notNullable().unique(); // e.g. hotels.view, bookings.cancel
    table.string('description');
  });

  await knex.schema.createTable('role_permissions', (table) => {
    table.increments('id').primary();
    table.integer('role_id').unsigned().notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.integer('permission_id').unsigned().notNullable().references('id').inTable('permissions').onDelete('CASCADE');
    table.unique(['role_id', 'permission_id']);
  });

  await knex.schema.alterTable('users', (table) => {
    table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('SET NULL');
    table.string('status').notNullable().defaultTo('active'); // active, disabled
  });

  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('admin_user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('action').notNullable(); // e.g. hotel.created, booking.cancelled
    table.string('entity_type').notNullable();
    table.string('entity_id');
    table.jsonb('before_value');
    table.jsonb('after_value');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.string('type').notNullable(); // new_booking, cancellation, payment_failed, refund_request, low_inventory, review_pending, system
    table.string('title').notNullable();
    table.text('message');
    table.boolean('is_read').notNullable().defaultTo(false);
    table.string('related_entity_type');
    table.string('related_entity_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('settings', (table) => {
    table.increments('id').primary();
    table.string('key').notNullable().unique();
    table.jsonb('value').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('role_id');
    table.dropColumn('status');
  });
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('roles');
};
