const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');

async function getSettings() {
  const rows = await db('settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Never expose gateway secrets/API keys through this endpoint's response.
async function upsertSetting(key, value) {
  const [row] = await db('settings')
    .insert({ key, value: JSON.stringify(value), updated_at: new Date() })
    .onConflict('key')
    .merge({ value: JSON.stringify(value), updated_at: new Date() })
    .returning('*');

  return row;
}

async function listTaxRules() {
  return db('tax_rules').orderBy('name');
}

async function createTaxRule({ name, appliesTo, valueType, value }) {
  if (!name || Number(value) < 0) throw ApiError.badRequest('Invalid tax rule');

  const [rule] = await db('tax_rules')
    .insert({ name, applies_to: appliesTo, value_type: valueType, value })
    .returning('*');

  return rule;
}

async function updateTaxRule(id, { value, active }) {
  if (value !== undefined && Number(value) < 0) throw ApiError.badRequest('Value cannot be negative');

  const [rule] = await db('tax_rules').where({ id }).update({ value, active }).returning('*');
  if (!rule) throw ApiError.notFound('Tax rule not found');
  return rule;
}

module.exports = { getSettings, upsertSetting, listTaxRules, createTaxRule, updateTaxRule };
