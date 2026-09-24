// Marketing offers shown on the guest site. Managed in the admin panel; the
// website only ever displays rows from this table (never raw coupons).
// An offer may promote a coupon code, in which case it is hidden automatically
// whenever that coupon is inactive or outside its validity window.
exports.up = async function (knex) {
  await knex.schema.createTable('offers', (table) => {
    table.increments('id').primary();
    table.string('title', 120).notNullable();
    table.string('subtitle', 300);
    table.string('badge', 40); // e.g. "Hotel deal", "Limited time"
    table.text('terms');
    table.integer('coupon_id').unsigned().references('id').inTable('coupons').onDelete('SET NULL');
    table.string('image_url');
    table.string('theme', 20).notNullable().defaultTo('beach'); // illustration used when there is no image
    table.string('cta_label', 40);
    table.string('cta_url', 255); // on-site path, e.g. /hotels?city=Goa
    table.date('valid_from');
    table.date('valid_until');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('show_at_checkout').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    table.index(['is_active', 'sort_order']);
    table.index('coupon_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('offers');
};
