const { ApiError } = require('../../core/ApiError');

/** Reports are about an Indian business: "a day" is an IST calendar day. */
const TZ = 'Asia/Kolkata';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
}

/** Named date ranges shared by the UI and the server-side defaults. */
function resolvePreset(preset) {
  const t = todayIST();
  const [y, m] = t.split('-').map(Number);
  const monthStart = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  const monthEnd = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
  const q = Math.floor((m - 1) / 3);
  switch (preset) {
    case 'today': return { from: t, to: t };
    case 'yesterday': return { from: addDays(t, -1), to: addDays(t, -1) };
    case 'next7': return { from: t, to: addDays(t, 6) };
    case 'next30': return { from: t, to: addDays(t, 29) };
    case 'last7': return { from: addDays(t, -6), to: t };
    case 'last90': return { from: addDays(t, -89), to: t };
    case 'thisMonth': return { from: monthStart(y, m), to: monthEnd(y, m) };
    case 'lastMonth': {
      const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      return { from: monthStart(py, pm), to: monthEnd(py, pm) };
    }
    case 'thisQuarter': return { from: monthStart(y, q * 3 + 1), to: monthEnd(y, q * 3 + 3) };
    case 'thisYear': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last365': return { from: addDays(t, -364), to: t };
    case 'last30':
    default: return { from: addDays(t, -29), to: t };
  }
}

function intOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Validates query parameters against a report's declared filters. Anything a
 * report doesn't declare is ignored, so a stray parameter can't change a query.
 */
function normalizeParams(def, query) {
  const params = {};
  const declared = Object.fromEntries(def.filters.map((f) => [f.key, f]));

  if (declared.dateRange) {
    const fallback = resolvePreset(def.defaultRange);
    const from = ISO_RE.test(query.from ?? '') ? query.from : fallback.from;
    const to = ISO_RE.test(query.to ?? '') ? query.to : fallback.to;
    if (to < from) throw ApiError.badRequest('The end date must be on or after the start date');
    const maxDays = def.maxRangeDays ?? 1100;
    if (daysBetween(from, to) > maxDays) throw ApiError.badRequest(`Choose a range of at most ${maxDays + 1} days for this report`);
    Object.assign(params, { from, to });
  }
  for (const f of def.filters) {
    if (f.key === 'dateRange') continue;
    const raw = query[f.key];
    if (f.type === 'hotel' || f.type === 'customer') {
      params[f.key] = intOrNull(raw);
    } else if (f.type === 'select') {
      const allowed = f.options.map((o) => o.value);
      params[f.key] = allowed.includes(raw) ? raw : f.default ?? allowed[0];
    } else if (f.type === 'number') {
      const n = Number(raw);
      params[f.key] = raw === undefined || raw === '' || !Number.isFinite(n) ? f.default ?? 0 : Math.min(f.max ?? n, Math.max(f.min ?? n, n));
    }
    if (f.required && (params[f.key] === null || params[f.key] === undefined)) {
      throw ApiError.badRequest(`Choose a ${f.label.toLowerCase()} to run this report`);
    }
  }
  return params;
}

module.exports = { TZ, todayIST, addDays, daysBetween, resolvePreset, normalizeParams };
