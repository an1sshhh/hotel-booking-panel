exports.seed = async function (knex) {
  await knex('tax_rules').del();
  await knex('tax_rules').insert([
    { name: 'GST', applies_to: 'tax', value_type: 'percentage', value: 5, active: true },
    { name: 'Service Charge', applies_to: 'service_charge', value_type: 'percentage', value: 0, active: false },
  ]);

  await knex('settings').del();
  await knex('settings').insert([
    { key: 'general', value: JSON.stringify({ site_name: 'Stayfarer', currency: 'INR', contact_email: '', contact_phone: '', logo_url: '' }) },
    { key: 'booking', value: JSON.stringify({ default_check_in_time: '14:00', default_check_out_time: '12:00' }) },
  ]);
};
