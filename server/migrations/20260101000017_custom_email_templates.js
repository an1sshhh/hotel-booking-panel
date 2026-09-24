// Admin-created email templates: flagged as custom (deletable, sent manually
// from the admin panel rather than by a system event), with their own list of
// variables and sample values for previews.
exports.up = async function (knex) {
  await knex.schema.alterTable('email_templates', (table) => {
    table.boolean('is_custom').notNullable().defaultTo(false);
    table.jsonb('variables').notNullable().defaultTo('[]');
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  });
  // OTP codes were briefly written into logged subjects; scrub them.
  await knex('email_outbox')
    .where({ template_key: 'admin_login_otp' })
    .update({ subject: knex.raw("regexp_replace(subject, '[0-9]{4,8}', '••••••', 'g')") });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('email_templates', (table) => {
    table.dropForeign('created_by');
    table.dropColumn('created_by');
    table.dropColumn('variables');
    table.dropColumn('is_custom');
  });
};
