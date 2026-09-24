// Admin-editable email templates + an outbox that doubles as the delivery log.
//
// Both servers enqueue into email_outbox; only admin/server sends (it owns the
// SMTP credentials), rendering each row through its template at send time.
// Default template content is seeded by admin/server on startup, so this
// migration stays identical in both servers' migration folders.
exports.up = async function (knex) {
  await knex.schema.createTable('email_templates', (table) => {
    table.increments('id').primary();
    table.string('key', 60).notNullable().unique(); // e.g. booking_confirmed, layout_guest
    table.string('kind', 10).notNullable().defaultTo('email'); // email | layout
    table.string('audience', 10).notNullable(); // guest | admin — picks the layout/theme
    table.string('name', 120).notNullable();
    table.string('description', 400);
    table.string('subject', 255); // null for layouts
    table.text('html').notNullable();
    table.boolean('is_enabled').notNullable().defaultTo(true);
    table.integer('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('email_outbox', (table) => {
    table.increments('id').primary();
    table.string('template_key', 60).notNullable();
    table.string('to_email', 255).notNullable();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.string('status', 12).notNullable().defaultTo('pending'); // pending | sent | failed | skipped
    table.integer('attempts').notNullable().defaultTo(0);
    table.text('last_error');
    table.string('subject', 255); // as rendered when sent
    table.string('related_entity_type', 40);
    table.string('related_entity_id', 40);
    table.timestamp('send_after').notNullable().defaultTo(knex.fn.now());
    table.timestamp('sent_at');
    table.timestamps(true, true);
    table.index(['status', 'send_after']);
    table.index(['template_key', 'created_at']);
    table.index(['related_entity_type', 'related_entity_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('email_outbox');
  await knex.schema.dropTableIfExists('email_templates');
};
