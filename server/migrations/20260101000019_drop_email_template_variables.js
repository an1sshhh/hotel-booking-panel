// Custom-template variables were removed from the admin panel; nothing reads
// or writes this column any more. Custom emails preview with booking sample data.
exports.up = async function (knex) {
  await knex.schema.alterTable('email_templates', (table) => {
    table.dropColumn('variables');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('email_templates', (table) => {
    table.jsonb('variables').notNullable().defaultTo('[]');
  });
};
