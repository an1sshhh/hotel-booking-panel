const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');
const { REPORTS, REPORT_BY_KEY } = require('./definitions');
const { normalizeParams, resolvePreset, todayIST, TZ } = require('./params');
const { toCsv, toPdf, formatDate } = require('./export');

const BRAND = 'Stay Farer';
const AUDIENCE_LABEL = { internal: 'Internal', partner: 'Shareable with hotels', guest: 'Shareable with guests' };

function definition(key) {
  const def = REPORT_BY_KEY[key];
  if (!def) throw ApiError.notFound('Report not found');
  return def;
}

/** What the Reports page needs to render the catalogue and each report's filter bar. */
function getCatalog() {
  return REPORTS.map(({ key, name, category, description, audience, filters, columns, defaultRange, maxRangeDays }) => ({
    key, name, category, description, audience, audienceLabel: AUDIENCE_LABEL[audience], filters, defaultRange,
    defaultDates: resolvePreset(defaultRange), maxRangeDays: maxRangeDays ?? null,
    columns: columns.map(({ key: k, label, type }) => ({ key: k, label, type })),
  }));
}

async function runReport(key, query) {
  const def = definition(key);
  const params = normalizeParams(def, query);
  const result = await def.run(params);
  return { key, params, columns: def.columns, ...result };
}

async function describeFilters(def, params) {
  const parts = [];
  if (params.from) parts.push(`${fmt(params.from)} – ${fmt(params.to)}`);
  for (const f of def.filters) {
    const v = params[f.key];
    if (f.type === 'hotel') parts.push(v ? `Hotel: ${(await db('hotels').where({ id: v }).first())?.name ?? `#${v}`}` : 'All hotels');
    else if (f.type === 'select') parts.push(`${f.label}: ${f.options.find((o) => o.value === v)?.label ?? v}`);
    else if (f.type === 'number') parts.push(`${f.label.replace(' %', '')}: ${v}%`);
  }
  return parts.join('  ·  ');
}

const fmt = formatDate;

async function exportReport(key, query, format) {
  const def = definition(key);
  const result = await runReport(key, query);
  const p = result.params;
  const stamp = p.from ? `${p.from}_to_${p.to}` : new Date().toISOString().slice(0, 10);
  const filename = `stayfarer-${key}-${stamp}.${format}`;
  if (format === 'csv') return { filename, contentType: 'text/csv; charset=utf-8', body: toCsv(def, result) };
  if (format === 'pdf') {
    const meta = {
      brand: BRAND,
      filterLine: await describeFilters(def, p),
      periodLine: p.from ? `${fmt(p.from)} – ${fmt(p.to)}` : '',
      generatedAt: `${formatDate(todayIST())}, ${new Date().toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })} IST`,
    };
    return { filename, contentType: 'application/pdf', stream: toPdf(def, result, meta) };
  }
  throw ApiError.badRequest('Format must be csv or pdf');
}

module.exports = { getCatalog, runReport, exportReport };
