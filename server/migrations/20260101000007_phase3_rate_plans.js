exports.up = async function (knex) {
  await knex.schema.createTable('rate_plans', (table) => {
    table.increments('id').primary();
    table.integer('room_type_id').unsigned().notNullable().references('id').inTable('room_types').onDelete('CASCADE');
    table.string('name').notNullable(); // Room Only, Breakfast Included, ...
    table.decimal('price', 10, 2).notNullable();
    table.string('currency').notNullable().defaultTo('INR');
    table.string('meal_inclusion').notNullable().defaultTo('no_meals'); // no_meals, breakfast, lunch, dinner, breakfast_lunch, breakfast_dinner, all_meals
    table.boolean('refundable').notNullable().defaultTo(true);
    table.string('status').notNullable().defaultTo('active'); // active, inactive
    table.timestamps(true, true);
  });

  await knex.schema.createTable('rate_plan_inclusions', (table) => {
    table.increments('id').primary();
    table.integer('rate_plan_id').unsigned().notNullable().references('id').inTable('rate_plans').onDelete('CASCADE');
    table.string('label').notNullable();
  });

  await knex.schema.createTable('cancellation_policies', (table) => {
    table.increments('id').primary();
    table.integer('rate_plan_id').unsigned().notNullable().references('id').inTable('rate_plans').onDelete('CASCADE');
    table.integer('days_before_checkin').notNullable(); // e.g. 7, 3, 0
    table.integer('refund_percent').notNullable(); // 0-100
    table.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('tax_rules', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('applies_to').notNullable().defaultTo('tax'); // tax, service_charge
    table.string('value_type').notNullable().defaultTo('percentage'); // percentage, fixed
    table.decimal('value', 10, 2).notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tax_rules');
  await knex.schema.dropTableIfExists('cancellation_policies');
  await knex.schema.dropTableIfExists('rate_plan_inclusions');
  await knex.schema.dropTableIfExists('rate_plans');
};
