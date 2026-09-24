// Templates are soft-deleted so a deleted system email can be restored, and
// so the admin server's default seeding (insert-if-missing) never resurrects it.
exports.up = async function (knex) {
  await knex.schema.alterTable('email_templates', (table) => {
    table.timestamp('deleted_at');
    table.integer('deleted_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('email_templates', (table) => {
    table.dropForeign('deleted_by');
    table.dropColumn('deleted_by');
    table.dropColumn('deleted_at');
  });
};
