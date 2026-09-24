const db = require('../../database/db');
const { TZ, addDays, daysBetween } = require('./params');

/*
 * Report registry. Each report declares its filters, columns and a run()
 * returning { rows, totals, summary, chart, subject }. The JSON view, CSV and
 * PDF exports are all generated from the same definition.
 *
 * Column types: text · date · int · money · percent · decimal
 * Audience: who the report is suitable to hand over to —
 *   internal (team only) · partner (a hotel) · guest (a customer)
 */

// Stays we count as revenue: pending holds and cancellations are excluded.
const REVENUE_STATUSES = ['confirmed', 'checked_in', 'checked_out'];
// Checkouts abandoned before payment are auto-cancelled; they're not real cancellations.
const NOT_ABANDONED = "bookings.cancellation_reason IS DISTINCT FROM 'Payment not completed'";

const BOOKED_ON = `(bookings.created_at AT TIME ZONE '${TZ}')::date`;
const STAY_ON = 'bookings.check_in';
const basisExpr = (p) => (p.dateBasis === 'stay' ? STAY_ON : BOOKED_ON);

const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Checked in', checked_out: 'Checked out',
  cancelled: 'Cancelled', refunded: 'Refunded', captured: 'Paid', partially_refunded: 'Part refunded',
  authorized: 'Authorized', failed: 'Failed', processing: 'Processing', completed: 'Completed',
};
const label = (s) => STATUS_LABELS[s] ?? String(s ?? '—');
const methodLabel = (m) => ({ upi: 'UPI', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet', emi: 'EMI', cash: 'Cash' })[m] ?? (m ? m[0].toUpperCase() + m.slice(1) : 'Online');

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const pct = (part, whole) => (Number(whole) ? r2((Number(part) / Number(whole)) * 100) : 0);
const div = (a, b) => (Number(b) ? r2(Number(a) / Number(b)) : 0);
const sum = (rows, key) => r2(rows.reduce((s, r) => s + Number(r[key] || 0), 0));

// ---------------------------------------------------------------- filters

const F = {
  dateRange: { key: 'dateRange', type: 'dateRange', label: 'Period' },
  dateBasis: (def = 'booked') => ({
    key: 'dateBasis', type: 'select', label: 'Dates by', default: def,
    options: [{ value: 'booked', label: 'Booking date' }, { value: 'stay', label: 'Stay date (check-in)' }],
  }),
  hotel: (required = false) => ({ key: 'hotelId', type: 'hotel', label: 'Hotel', required }),
  customer: { key: 'customerId', type: 'customer', label: 'Customer', required: true },
  groupBy: (def = 'day') => ({
    key: 'groupBy', type: 'select', label: 'Group by', default: def,
    options: [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }],
  }),
};

function scopeHotel(q, p, col = 'bookings.hotel_id') {
  return p.hotelId ? q.where(col, p.hotelId) : q;
}

function inRange(q, expr, p) {
  return q.whereRaw(`${expr} BETWEEN ? AND ?`, [p.from, p.to]);
}

// ---------------------------------------------------------------- periods

function periodStart(iso, unit) {
  if (unit === 'month') return `${iso.slice(0, 7)}-01`;
  if (unit === 'week') {
    const d = new Date(`${iso}T00:00:00Z`);
    return addDays(iso, -((d.getUTCDay() + 6) % 7)); // ISO weeks start Monday, as date_trunc does
  }
  return iso;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function periodLabel(iso, unit) {
  const [y, m, d] = iso.split('-').map(Number);
  if (unit === 'month') return `${MONTHS[m - 1]} ${y}`;
  return unit === 'week' ? `Week of ${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]}`;
}

/** Every period between from and to, so gaps show as zero instead of disappearing. */
function periodsBetween(from, to, unit) {
  const out = [];
  let cur = periodStart(from, unit);
  while (cur <= to) {
    out.push(cur);
    if (unit === 'month') {
      const d = new Date(`${cur}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + 1);
      cur = d.toISOString().slice(0, 10);
    } else cur = addDays(cur, unit === 'week' ? 7 : 1);
  }
  return out;
}

const truncExpr = (unit, expr) => `date_trunc('${unit}', ${expr})::date`; // unit is whitelisted by the select filter

// ---------------------------------------------------------------- shared queries

function revenueBookings(p) {
  let q = db('bookings').whereIn('bookings.booking_status', REVENUE_STATUSES);
  q = inRange(q, basisExpr(p), p);
  return scopeHotel(q, p);
}

const REVENUE_AGG = [
  db.raw('count(*)::int as bookings'),
  db.raw('coalesce(sum(bookings.nights * bookings.num_rooms), 0)::int as room_nights'),
  db.raw('coalesce(sum(bookings.room_price), 0) as gross'),
  db.raw('coalesce(sum(bookings.discount_amount), 0) as discounts'),
  db.raw('coalesce(sum(bookings.tax_amount + bookings.fee_amount), 0) as taxes'),
  db.raw('coalesce(sum(bookings.total_amount), 0) as revenue'),
];

async function refundsByBooking(ids) {
  if (!ids.length) return {};
  const rows = await db('refunds').whereIn('booking_id', ids).whereNot('status', 'failed').groupBy('booking_id').select('booking_id').sum('amount as refunded');
  return Object.fromEntries(rows.map((r) => [r.booking_id, Number(r.refunded)]));
}

async function paidByBooking(ids) {
  if (!ids.length) return {};
  const rows = await db('payments').whereIn('booking_id', ids).whereIn('status', ['captured', 'partially_refunded', 'refunded']).groupBy('booking_id').select('booking_id').sum('amount as paid');
  return Object.fromEntries(rows.map((r) => [r.booking_id, Number(r.paid)]));
}

// ---------------------------------------------------------------- reports

const REPORTS = [
  // ================================================================ Revenue
  {
    key: 'revenue-summary',
    name: 'Revenue summary',
    category: 'Revenue',
    audience: 'internal',
    description: 'Revenue, room nights and average daily rate per day, week or month — gaps shown as zero.',
    filters: [F.dateRange, F.groupBy('day'), F.dateBasis(), F.hotel()],
    defaultRange: 'last30',
    columns: [
      { key: 'period', label: 'Period', type: 'text' },
      { key: 'bookings', label: 'Bookings', type: 'int' },
      { key: 'room_nights', label: 'Room nights', type: 'int' },
      { key: 'gross', label: 'Room revenue', type: 'money' },
      { key: 'discounts', label: 'Discounts', type: 'money' },
      { key: 'taxes', label: 'Taxes & fees', type: 'money' },
      { key: 'revenue', label: 'Total revenue', type: 'money' },
      { key: 'adr', label: 'ADR', type: 'money' },
    ],
    async run(p) {
      const unit = p.groupBy;
      const rows = await revenueBookings(p).select(db.raw(`${truncExpr(unit, basisExpr(p))} as period_start`), ...REVENUE_AGG).groupByRaw('1');
      const byStart = Object.fromEntries(rows.map((r) => [typeof r.period_start === 'string' ? r.period_start : r.period_start.toISOString().slice(0, 10), r]));
      const out = periodsBetween(p.from, p.to, unit).map((start) => {
        const r = byStart[start] ?? {};
        return {
          date: start, // not a column (so not exported); used by the dashboard chart
          period: periodLabel(start, unit),
          bookings: Number(r.bookings || 0), room_nights: Number(r.room_nights || 0),
          gross: r2(r.gross), discounts: r2(r.discounts), taxes: r2(r.taxes), revenue: r2(r.revenue),
          adr: div(Number(r.gross || 0) - Number(r.discounts || 0), r.room_nights),
        };
      });
      const t = { bookings: sum(out, 'bookings'), room_nights: sum(out, 'room_nights'), gross: sum(out, 'gross'), discounts: sum(out, 'discounts'), taxes: sum(out, 'taxes'), revenue: sum(out, 'revenue') };
      t.adr = div(t.gross - t.discounts, t.room_nights);
      return {
        rows: out,
        totals: { period: 'Total', ...t },
        summary: [
          { label: 'Total revenue', value: t.revenue, type: 'money' },
          { label: 'Bookings', value: t.bookings, type: 'int' },
          { label: 'Room nights', value: t.room_nights, type: 'int' },
          { label: 'Average daily rate', value: t.adr, type: 'money' },
          { label: 'Avg booking value', value: div(t.revenue, t.bookings), type: 'money' },
        ],
        chart: { title: `Revenue by ${unit}`, type: 'money', layout: 'columns', data: out.map((r) => ({ label: r.period, value: r.revenue })) },
      };
    },
  },
  {
    key: 'hotel-performance',
    name: 'Hotel performance',
    category: 'Revenue',
    audience: 'internal',
    description: 'Each property side by side: revenue, share of total, ADR and cancellation rate.',
    filters: [F.dateRange, F.dateBasis()],
    defaultRange: 'last30',
    columns: [
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'bookings', label: 'Bookings', type: 'int' },
      { key: 'room_nights', label: 'Room nights', type: 'int' },
      { key: 'revenue', label: 'Revenue', type: 'money' },
      { key: 'share', label: 'Share', type: 'percent' },
      { key: 'adr', label: 'ADR', type: 'money' },
      { key: 'cancellations', label: 'Cancelled', type: 'int' },
      { key: 'cancel_rate', label: 'Cancel rate', type: 'percent' },
    ],
    async run(p) {
      const [rev, cancelled] = await Promise.all([
        revenueBookings(p).join('hotels', 'hotels.id', 'bookings.hotel_id')
          .groupBy('hotels.id', 'hotels.name', 'hotels.city')
          .select('hotels.id', 'hotels.name', 'hotels.city', ...REVENUE_AGG),
        inRange(db('bookings').where('booking_status', 'cancelled').whereRaw(NOT_ABANDONED), basisExpr(p), p)
          .groupBy('hotel_id').select('hotel_id').count('* as n'),
      ]);
      const cancelledBy = Object.fromEntries(cancelled.map((c) => [c.hotel_id, Number(c.n)]));
      const ids = new Set([...rev.map((r) => r.id), ...Object.keys(cancelledBy).map(Number)]);
      const names = Object.fromEntries((await db('hotels').whereIn('id', [...ids]).select('id', 'name', 'city')).map((h) => [h.id, h]));
      const total = rev.reduce((s, r) => s + Number(r.revenue), 0);
      const rows = [...ids].map((id) => {
        const r = rev.find((x) => x.id === id) ?? {};
        const c = cancelledBy[id] ?? 0;
        const b = Number(r.bookings || 0);
        return {
          hotel: names[id]?.name ?? `Hotel #${id}`, city: names[id]?.city ?? '',
          bookings: b, room_nights: Number(r.room_nights || 0), revenue: r2(r.revenue),
          share: pct(r.revenue, total), adr: div(Number(r.gross || 0) - Number(r.discounts || 0), r.room_nights),
          cancellations: c, cancel_rate: pct(c, b + c),
        };
      }).sort((a, b) => b.revenue - a.revenue);
      const t = { bookings: sum(rows, 'bookings'), room_nights: sum(rows, 'room_nights'), revenue: sum(rows, 'revenue'), cancellations: sum(rows, 'cancellations') };
      return {
        rows,
        totals: { hotel: 'Total', city: '', ...t, share: rows.length ? 100 : 0, adr: div(rev.reduce((s, r) => s + Number(r.gross) - Number(r.discounts), 0), t.room_nights), cancel_rate: pct(t.cancellations, t.bookings + t.cancellations) },
        summary: [
          { label: 'Total revenue', value: t.revenue, type: 'money' },
          { label: 'Properties with bookings', value: rows.filter((r) => r.bookings).length, type: 'int' },
          { label: 'Top property', value: rows[0]?.hotel ?? '—', type: 'text' },
          { label: 'Cancellation rate', value: pct(t.cancellations, t.bookings + t.cancellations), type: 'percent' },
        ],
        chart: { title: 'Revenue by hotel', type: 'money', data: rows.map((r) => ({ label: r.hotel, value: r.revenue })) },
      };
    },
  },
  {
    key: 'room-type-performance',
    name: 'Room type performance',
    category: 'Revenue',
    audience: 'partner',
    description: 'Which rooms sell: bookings, room nights, revenue and ADR for every room type.',
    filters: [F.dateRange, F.dateBasis(), F.hotel()],
    defaultRange: 'last30',
    columns: [
      { key: 'room', label: 'Room type', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'bookings', label: 'Bookings', type: 'int' },
      { key: 'room_nights', label: 'Room nights', type: 'int' },
      { key: 'revenue', label: 'Revenue', type: 'money' },
      { key: 'share', label: 'Share', type: 'percent' },
      { key: 'adr', label: 'ADR', type: 'money' },
    ],
    async run(p) {
      const rev = await revenueBookings(p)
        .join('room_types', 'room_types.id', 'bookings.room_type_id')
        .join('hotels', 'hotels.id', 'bookings.hotel_id')
        .groupBy('room_types.id', 'room_types.name', 'hotels.name')
        .select('room_types.name as room', 'hotels.name as hotel', ...REVENUE_AGG);
      const total = rev.reduce((s, r) => s + Number(r.revenue), 0);
      const rows = rev.map((r) => ({
        room: r.room, hotel: r.hotel, bookings: r.bookings, room_nights: r.room_nights, revenue: r2(r.revenue),
        share: pct(r.revenue, total), adr: div(Number(r.gross) - Number(r.discounts), r.room_nights),
      })).sort((a, b) => b.revenue - a.revenue);
      const t = { bookings: sum(rows, 'bookings'), room_nights: sum(rows, 'room_nights'), revenue: sum(rows, 'revenue') };
      return {
        rows,
        totals: { room: 'Total', hotel: '', ...t, share: rows.length ? 100 : 0, adr: div(rev.reduce((s, r) => s + Number(r.gross) - Number(r.discounts), 0), t.room_nights) },
        summary: [
          { label: 'Revenue', value: t.revenue, type: 'money' },
          { label: 'Room nights', value: t.room_nights, type: 'int' },
          { label: 'Best seller', value: rows[0]?.room ?? '—', type: 'text' },
        ],
        chart: { title: 'Revenue by room type', type: 'money', data: rows.slice(0, 12).map((r) => ({ label: r.room, value: r.revenue })) },
      };
    },
  },
  {
    key: 'occupancy',
    name: 'Occupancy & RevPAR',
    category: 'Revenue',
    audience: 'partner',
    description: 'Rooms available vs sold per night, occupancy %, ADR and RevPAR for each room type. Revenue is spread across the nights actually stayed.',
    filters: [F.dateRange, F.hotel()],
    defaultRange: 'last30',
    maxRangeDays: 365,
    columns: [
      { key: 'room', label: 'Room type', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'available', label: 'Available', type: 'int' },
      { key: 'sold', label: 'Sold', type: 'int' },
      { key: 'occupancy', label: 'Occupancy', type: 'percent' },
      { key: 'revenue', label: 'Room revenue', type: 'money' },
      { key: 'adr', label: 'ADR', type: 'money' },
      { key: 'revpar', label: 'RevPAR', type: 'money' },
    ],
    async run(p) {
      let rtq = db('room_types').join('hotels', 'hotels.id', 'room_types.hotel_id').where('room_types.status', 'active')
        .select('room_types.id', 'room_types.name as room', 'hotels.name as hotel');
      rtq = scopeHotel(rtq, p, 'room_types.hotel_id');
      const roomTypes = await rtq;
      const ids = roomTypes.map((r) => r.id);
      const [avail, stays] = await Promise.all([
        ids.length ? db('room_inventory').whereIn('room_type_id', ids).whereBetween('date', [p.from, p.to]).groupBy('room_type_id').select('room_type_id').select(db.raw('sum(total - blocked)::int as available')) : [],
        ids.length ? db('bookings').whereIn('room_type_id', ids).whereIn('booking_status', REVENUE_STATUSES).where('check_in', '<=', p.to).where('check_out', '>', p.from).select('room_type_id', 'check_in', 'check_out', 'nights', 'num_rooms', 'room_price', 'discount_amount') : [],
      ]);
      const availBy = Object.fromEntries(avail.map((a) => [a.room_type_id, Number(a.available)]));
      const sold = {};
      const revenue = {};
      const endExclusive = addDays(p.to, 1);
      for (const b of stays) {
        // Nights of this stay that fall inside the report period.
        const start = b.check_in > p.from ? b.check_in : p.from;
        const end = b.check_out < endExclusive ? b.check_out : endExclusive;
        const n = Math.max(0, daysBetween(start, end));
        if (!n) continue;
        sold[b.room_type_id] = (sold[b.room_type_id] ?? 0) + n * b.num_rooms;
        revenue[b.room_type_id] = (revenue[b.room_type_id] ?? 0) + ((Number(b.room_price) - Number(b.discount_amount)) / Math.max(1, b.nights)) * n;
      }
      const rows = roomTypes.map((r) => {
        const a = availBy[r.id] ?? 0;
        const s = sold[r.id] ?? 0;
        const rev = r2(revenue[r.id] ?? 0);
        return { room: r.room, hotel: r.hotel, available: a, sold: s, occupancy: pct(s, a), revenue: rev, adr: div(rev, s), revpar: div(rev, a) };
      }).sort((x, y) => y.occupancy - x.occupancy || y.revenue - x.revenue);
      const t = { available: sum(rows, 'available'), sold: sum(rows, 'sold'), revenue: sum(rows, 'revenue') };
      return {
        rows,
        totals: { room: 'Total', hotel: '', ...t, occupancy: pct(t.sold, t.available), adr: div(t.revenue, t.sold), revpar: div(t.revenue, t.available) },
        summary: [
          { label: 'Occupancy', value: pct(t.sold, t.available), type: 'percent' },
          { label: 'ADR', value: div(t.revenue, t.sold), type: 'money' },
          { label: 'RevPAR', value: div(t.revenue, t.available), type: 'money' },
          { label: 'Room nights sold', value: t.sold, type: 'int' },
        ],
        chart: { title: 'Occupancy by room type', type: 'percent', data: rows.slice(0, 12).map((r) => ({ label: r.room, value: r.occupancy })) },
        note: t.available === 0 ? 'No room inventory is configured for this period, so occupancy can’t be calculated. Add inventory for these dates in Hotels → Rooms.' : null,
      };
    },
  },

  // ================================================================ Bookings & operations
  {
    key: 'bookings-register',
    name: 'Bookings register',
    category: 'Bookings & operations',
    audience: 'partner',
    description: 'Every booking in the period with guest, stay, status and value. Abandoned checkouts are left out.',
    filters: [
      F.dateRange, F.dateBasis(), F.hotel(),
      { key: 'status', type: 'select', label: 'Status', default: 'all', options: [
        { value: 'all', label: 'All statuses' }, { value: 'active', label: 'Confirmed & stayed' },
        { value: 'pending', label: 'Pending' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'checked_in', label: 'Checked in' },
        { value: 'checked_out', label: 'Checked out' }, { value: 'cancelled', label: 'Cancelled' },
      ] },
    ],
    defaultRange: 'last30',
    columns: [
      { key: 'ref', label: 'Reference', type: 'text' },
      { key: 'booked_on', label: 'Booked on', type: 'date' },
      { key: 'guest', label: 'Guest', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'room', label: 'Room', type: 'text' },
      { key: 'check_in', label: 'Check-in', type: 'date' },
      { key: 'check_out', label: 'Check-out', type: 'date' },
      { key: 'nights', label: 'Nights', type: 'int' },
      { key: 'guests', label: 'Guests', type: 'int' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'payment', label: 'Payment', type: 'text' },
      { key: 'total', label: 'Total', type: 'money' },
    ],
    async run(p) {
      let q = db('bookings')
        .join('hotels', 'hotels.id', 'bookings.hotel_id')
        .leftJoin('room_types', 'room_types.id', 'bookings.room_type_id')
        .leftJoin('customers', 'customers.id', 'bookings.customer_id')
        .whereRaw(NOT_ABANDONED);
      q = scopeHotel(inRange(q, basisExpr(p), p), p);
      if (p.status === 'active') q = q.whereIn('bookings.booking_status', REVENUE_STATUSES);
      else if (p.status !== 'all') q = q.where('bookings.booking_status', p.status);
      const list = await q.select(
        'bookings.*', 'hotels.name as hotel', 'room_types.name as room', 'customers.name as customer_name',
        db.raw(`${BOOKED_ON} as booked_on`)
      ).orderBy('bookings.created_at', 'desc').limit(10000);
      const rows = list.map((b) => ({
        ref: b.booking_ref ?? `#${b.id}`, booked_on: b.booked_on, guest: b.guest_name || b.customer_name || '—',
        hotel: b.hotel, room: `${b.num_rooms} × ${b.room ?? 'Room'}`, check_in: b.check_in, check_out: b.check_out,
        nights: b.nights, guests: b.guests, status: label(b.booking_status), payment: label(b.payment_status), total: r2(b.total_amount),
      }));
      const active = list.filter((b) => REVENUE_STATUSES.includes(b.booking_status));
      return {
        rows,
        totals: { ref: 'Total', nights: sum(rows, 'nights'), guests: sum(rows, 'guests'), total: sum(rows, 'total') },
        summary: [
          { label: 'Bookings', value: rows.length, type: 'int' },
          { label: 'Confirmed value', value: r2(active.reduce((s, b) => s + Number(b.total_amount), 0)), type: 'money' },
          { label: 'Room nights', value: active.reduce((s, b) => s + b.nights * b.num_rooms, 0), type: 'int' },
          { label: 'Cancelled', value: list.filter((b) => b.booking_status === 'cancelled').length, type: 'int' },
        ],
        truncated: list.length === 10000,
      };
    },
  },
  {
    key: 'arrivals-departures',
    name: 'Arrivals & departures',
    category: 'Bookings & operations',
    audience: 'partner',
    description: 'Who checks in and out each day — a front-desk list with contact numbers and requests.',
    filters: [F.dateRange, F.hotel()],
    defaultRange: 'next7',
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'movement', label: 'Movement', type: 'text' },
      { key: 'ref', label: 'Reference', type: 'text' },
      { key: 'guest', label: 'Guest', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'room', label: 'Room', type: 'text' },
      { key: 'nights', label: 'Nights', type: 'int' },
      { key: 'guests', label: 'Guests', type: 'int' },
      { key: 'requests', label: 'Requests', type: 'text' },
    ],
    async run(p) {
      let q = db('bookings')
        .join('hotels', 'hotels.id', 'bookings.hotel_id')
        .leftJoin('room_types', 'room_types.id', 'bookings.room_type_id')
        .leftJoin('customers', 'customers.id', 'bookings.customer_id')
        .whereIn('bookings.booking_status', REVENUE_STATUSES)
        .where((w) => w.whereBetween('bookings.check_in', [p.from, p.to]).orWhereBetween('bookings.check_out', [p.from, p.to]));
      q = scopeHotel(q, p);
      const list = await q.select('bookings.*', 'hotels.name as hotel', 'room_types.name as room', 'customers.name as customer_name', 'customers.phone as customer_phone');
      const rows = [];
      for (const b of list) {
        const base = {
          ref: b.booking_ref ?? `#${b.id}`, guest: b.guest_name || b.customer_name || '—', phone: b.guest_phone || b.customer_phone || '',
          hotel: b.hotel, room: `${b.num_rooms} × ${b.room ?? 'Room'}`, nights: b.nights, guests: b.guests, requests: b.special_requests || '',
        };
        if (b.check_in >= p.from && b.check_in <= p.to) rows.push({ date: b.check_in, movement: 'Arrival', ...base });
        if (b.check_out >= p.from && b.check_out <= p.to) rows.push({ date: b.check_out, movement: 'Departure', ...base });
      }
      rows.sort((a, b) => a.date.localeCompare(b.date) || a.movement.localeCompare(b.movement) || a.guest.localeCompare(b.guest));
      const arrivals = rows.filter((r) => r.movement === 'Arrival');
      return {
        rows,
        totals: null,
        summary: [
          { label: 'Arrivals', value: arrivals.length, type: 'int' },
          { label: 'Departures', value: rows.length - arrivals.length, type: 'int' },
          { label: 'Guests arriving', value: sum(arrivals, 'guests'), type: 'int' },
        ],
      };
    },
  },
  {
    key: 'cancellations',
    name: 'Cancellations',
    category: 'Bookings & operations',
    audience: 'partner',
    description: 'Cancelled bookings with notice given, reason, value lost and amount refunded. Abandoned checkouts are left out.',
    filters: [F.dateRange, F.hotel()],
    defaultRange: 'last90',
    columns: [
      { key: 'ref', label: 'Reference', type: 'text' },
      { key: 'guest', label: 'Guest', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'cancelled_on', label: 'Cancelled on', type: 'date' },
      { key: 'check_in', label: 'Check-in', type: 'date' },
      { key: 'notice', label: 'Days’ notice', type: 'int' },
      { key: 'reason', label: 'Reason', type: 'text' },
      { key: 'value', label: 'Booking value', type: 'money' },
      { key: 'refunded', label: 'Refunded', type: 'money' },
    ],
    async run(p) {
      const cancelledOn = `(coalesce(bookings.cancelled_at, bookings.updated_at) AT TIME ZONE '${TZ}')::date`;
      let q = db('bookings').join('hotels', 'hotels.id', 'bookings.hotel_id').leftJoin('customers', 'customers.id', 'bookings.customer_id')
        .where('bookings.booking_status', 'cancelled').whereRaw(NOT_ABANDONED);
      q = scopeHotel(inRange(q, cancelledOn, p), p);
      const list = await q.select('bookings.*', 'hotels.name as hotel', 'customers.name as customer_name', db.raw(`${cancelledOn} as cancelled_on`)).orderByRaw(`${cancelledOn} desc`);
      const refunds = await refundsByBooking(list.map((b) => b.id));
      const rows = list.map((b) => ({
        ref: b.booking_ref ?? `#${b.id}`, guest: b.guest_name || b.customer_name || '—', hotel: b.hotel,
        cancelled_on: b.cancelled_on, check_in: b.check_in, notice: Math.max(0, daysBetween(b.cancelled_on, b.check_in)),
        reason: b.cancellation_reason || '—', value: r2(b.total_amount), refunded: r2(refunds[b.id] ?? 0),
      }));
      let booked = db('bookings').whereRaw(NOT_ABANDONED);
      booked = scopeHotel(inRange(booked, BOOKED_ON, p), p);
      const [{ n: bookedCount }] = await booked.count('* as n');
      const t = { value: sum(rows, 'value'), refunded: sum(rows, 'refunded') };
      return {
        rows,
        totals: { ref: 'Total', ...t, notice: rows.length ? Math.round(sum(rows, 'notice') / rows.length) : 0 },
        summary: [
          { label: 'Cancellations', value: rows.length, type: 'int' },
          { label: 'Cancellation rate', value: pct(rows.length, Math.max(Number(bookedCount), rows.length)), type: 'percent' },
          { label: 'Value cancelled', value: t.value, type: 'money' },
          { label: 'Refunded', value: t.refunded, type: 'money' },
          { label: 'Avg notice (days)', value: rows.length ? Math.round(sum(rows, 'notice') / rows.length) : 0, type: 'int' },
        ],
      };
    },
  },
  {
    key: 'booking-behaviour',
    name: 'Booking behaviour',
    category: 'Bookings & operations',
    audience: 'internal',
    description: 'How far ahead guests book (lead time) or how long they stay — with volume and average value for each band.',
    filters: [
      F.dateRange, F.dateBasis(), F.hotel(),
      { key: 'dimension', type: 'select', label: 'Analyse', default: 'lead', options: [{ value: 'lead', label: 'Lead time' }, { value: 'los', label: 'Length of stay' }] },
    ],
    defaultRange: 'last90',
    columns: [
      { key: 'band', label: 'Band', type: 'text' },
      { key: 'bookings', label: 'Bookings', type: 'int' },
      { key: 'share', label: 'Share', type: 'percent' },
      { key: 'avg_nights', label: 'Avg nights', type: 'decimal' },
      { key: 'avg_value', label: 'Avg booking value', type: 'money' },
      { key: 'revenue', label: 'Revenue', type: 'money' },
    ],
    async run(p) {
      const list = await revenueBookings(p).select('check_in', 'nights', 'total_amount', db.raw(`${BOOKED_ON} as booked_on`));
      const bands = p.dimension === 'los'
        ? [['1 night', 1, 1], ['2 nights', 2, 2], ['3–4 nights', 3, 4], ['5–7 nights', 5, 7], ['8+ nights', 8, Infinity]]
        : [['Same / next day', 0, 1], ['2–7 days ahead', 2, 7], ['8–30 days ahead', 8, 30], ['31–90 days ahead', 31, 90], ['90+ days ahead', 91, Infinity]];
      const value = (b) => (p.dimension === 'los' ? b.nights : Math.max(0, daysBetween(b.booked_on, b.check_in)));
      const rows = bands.map(([band, lo, hi]) => {
        const inBand = list.filter((b) => value(b) >= lo && value(b) <= hi);
        const rev = inBand.reduce((s, b) => s + Number(b.total_amount), 0);
        return {
          band, bookings: inBand.length, share: pct(inBand.length, list.length),
          avg_nights: inBand.length ? r2(inBand.reduce((s, b) => s + b.nights, 0) / inBand.length) : 0,
          avg_value: div(rev, inBand.length), revenue: r2(rev),
        };
      });
      const avgLead = list.length ? Math.round(list.reduce((s, b) => s + Math.max(0, daysBetween(b.booked_on, b.check_in)), 0) / list.length) : 0;
      return {
        rows,
        totals: { band: 'Total', bookings: list.length, share: list.length ? 100 : 0, avg_nights: list.length ? r2(list.reduce((s, b) => s + b.nights, 0) / list.length) : 0, avg_value: div(sum(rows, 'revenue'), list.length), revenue: sum(rows, 'revenue') },
        summary: [
          { label: 'Bookings analysed', value: list.length, type: 'int' },
          { label: 'Avg lead time (days)', value: avgLead, type: 'int' },
          { label: 'Avg length of stay', value: list.length ? r2(list.reduce((s, b) => s + b.nights, 0) / list.length) : 0, type: 'decimal' },
        ],
        chart: { title: p.dimension === 'los' ? 'Bookings by length of stay' : 'Bookings by lead time', type: 'int', data: rows.map((r) => ({ label: r.band, value: r.bookings })) },
      };
    },
  },

  // ================================================================ Finance
  {
    key: 'payments',
    name: 'Payments & settlement',
    category: 'Finance',
    audience: 'internal',
    description: 'Money received online per payment: method, gateway reference, refunds and net settled.',
    filters: [
      F.dateRange, F.hotel(),
      { key: 'method', type: 'select', label: 'Method', default: 'all', options: [
        { value: 'all', label: 'All methods' }, { value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' },
        { value: 'netbanking', label: 'Netbanking' }, { value: 'wallet', label: 'Wallet' },
      ] },
    ],
    defaultRange: 'last30',
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'ref', label: 'Booking', type: 'text' },
      { key: 'guest', label: 'Guest', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'method', label: 'Method', type: 'text' },
      { key: 'payment_id', label: 'Payment ID', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'refunded', label: 'Refunded', type: 'money' },
      { key: 'net', label: 'Net', type: 'money' },
    ],
    async run(p) {
      const paidOn = `(coalesce(payments.captured_at, payments.created_at) AT TIME ZONE '${TZ}')::date`;
      let q = db('payments').join('bookings', 'bookings.id', 'payments.booking_id').join('hotels', 'hotels.id', 'bookings.hotel_id')
        .leftJoin('customers', 'customers.id', 'bookings.customer_id')
        .whereIn('payments.status', ['captured', 'partially_refunded', 'refunded']);
      q = scopeHotel(inRange(q, paidOn, p), p);
      if (p.method !== 'all') q = q.where('payments.method', p.method);
      const list = await q.select('payments.*', 'bookings.booking_ref', 'bookings.guest_name', 'customers.name as customer_name', 'hotels.name as hotel', db.raw(`${paidOn} as paid_on`)).orderBy('payments.id', 'desc');
      const refunds = list.length
        ? Object.fromEntries((await db('refunds').whereIn('payment_id', list.map((x) => x.id)).whereNot('status', 'failed').groupBy('payment_id').select('payment_id').sum('amount as r')).map((x) => [x.payment_id, Number(x.r)]))
        : {};
      const rows = list.map((x) => {
        const refunded = r2(refunds[x.id] ?? 0);
        return {
          date: x.paid_on, ref: x.booking_ref ?? `#${x.booking_id}`, guest: x.guest_name || x.customer_name || '—', hotel: x.hotel,
          method: methodLabel(x.method), payment_id: x.razorpay_payment_id || x.transaction_ref || '—',
          amount: r2(x.amount), refunded, net: r2(Number(x.amount) - refunded),
        };
      });
      const byMethod = {};
      for (const r of rows) byMethod[r.method] = (byMethod[r.method] ?? 0) + r.amount;
      const t = { amount: sum(rows, 'amount'), refunded: sum(rows, 'refunded'), net: sum(rows, 'net') };
      return {
        rows,
        totals: { date: 'Total', ...t },
        summary: [
          { label: 'Collected', value: t.amount, type: 'money' },
          { label: 'Refunded', value: t.refunded, type: 'money' },
          { label: 'Net settled', value: t.net, type: 'money' },
          { label: 'Payments', value: rows.length, type: 'int' },
        ],
        chart: { title: 'Collected by payment method', type: 'money', data: Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: r2(v) })) },
      };
    },
  },
  {
    key: 'refunds',
    name: 'Refunds',
    category: 'Finance',
    audience: 'internal',
    description: 'Every refund issued, its gateway reference and whether the bank has processed it.',
    filters: [
      F.dateRange, F.hotel(),
      { key: 'status', type: 'select', label: 'Status', default: 'all', options: [
        { value: 'all', label: 'All statuses' }, { value: 'processing', label: 'Processing' }, { value: 'completed', label: 'Completed' },
        { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' },
      ] },
    ],
    defaultRange: 'last90',
    columns: [
      { key: 'date', label: 'Issued on', type: 'date' },
      { key: 'ref', label: 'Booking', type: 'text' },
      { key: 'guest', label: 'Guest', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'refund_id', label: 'Refund ID', type: 'text' },
      { key: 'reason', label: 'Reason', type: 'text' },
    ],
    async run(p) {
      const issuedOn = `(refunds.created_at AT TIME ZONE '${TZ}')::date`;
      let q = db('refunds').join('bookings', 'bookings.id', 'refunds.booking_id').join('hotels', 'hotels.id', 'bookings.hotel_id')
        .leftJoin('customers', 'customers.id', 'bookings.customer_id');
      q = scopeHotel(inRange(q, issuedOn, p), p);
      if (p.status !== 'all') q = q.where('refunds.status', p.status);
      const list = await q.select('refunds.*', 'bookings.booking_ref', 'bookings.guest_name', 'customers.name as customer_name', 'hotels.name as hotel', db.raw(`${issuedOn} as issued_on`)).orderBy('refunds.id', 'desc');
      const rows = list.map((x) => ({
        date: x.issued_on, ref: x.booking_ref ?? `#${x.booking_id}`, guest: x.guest_name || x.customer_name || '—', hotel: x.hotel,
        amount: r2(x.amount), status: label(x.status), refund_id: x.gateway_refund_id || 'Offline', reason: x.reason || '—',
      }));
      const open = list.filter((x) => ['pending', 'processing'].includes(x.status));
      return {
        rows,
        totals: { date: 'Total', amount: sum(rows, 'amount') },
        summary: [
          { label: 'Refunded', value: sum(rows, 'amount'), type: 'money' },
          { label: 'Refunds', value: rows.length, type: 'int' },
          { label: 'Still processing', value: open.length, type: 'int' },
          { label: 'Failed', value: list.filter((x) => x.status === 'failed').length, type: 'int' },
        ],
      };
    },
  },
  {
    key: 'tax-summary',
    name: 'Tax (GST) summary',
    category: 'Finance',
    audience: 'partner',
    description: 'Taxable value, tax and fees collected per period and hotel — ready for GST filing. Taxable value is room charges after discounts.',
    filters: [F.dateRange, F.groupBy('month'), F.dateBasis('stay'), F.hotel()],
    defaultRange: 'thisQuarter',
    columns: [
      { key: 'period', label: 'Period', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'bookings', label: 'Invoices', type: 'int' },
      { key: 'taxable', label: 'Taxable value', type: 'money' },
      { key: 'tax', label: 'Tax', type: 'money' },
      { key: 'fees', label: 'Fees', type: 'money' },
      { key: 'total', label: 'Invoice total', type: 'money' },
      { key: 'rate', label: 'Effective rate', type: 'percent' },
    ],
    async run(p) {
      const unit = p.groupBy;
      const list = await revenueBookings(p).join('hotels', 'hotels.id', 'bookings.hotel_id')
        .groupByRaw(`1, hotels.name`)
        .select(db.raw(`${truncExpr(unit, basisExpr(p))} as period_start`), 'hotels.name as hotel')
        .select(db.raw('count(*)::int as bookings'), db.raw('sum(bookings.room_price - bookings.discount_amount) as taxable'),
          db.raw('sum(bookings.tax_amount) as tax'), db.raw('sum(bookings.fee_amount) as fees'), db.raw('sum(bookings.total_amount) as total'))
        .orderByRaw('1, hotels.name');
      const rows = list.map((r) => {
        const start = typeof r.period_start === 'string' ? r.period_start : r.period_start.toISOString().slice(0, 10);
        return { period: periodLabel(start, unit), hotel: r.hotel, bookings: r.bookings, taxable: r2(r.taxable), tax: r2(r.tax), fees: r2(r.fees), total: r2(r.total), rate: pct(r.tax, r.taxable) };
      });
      const t = { bookings: sum(rows, 'bookings'), taxable: sum(rows, 'taxable'), tax: sum(rows, 'tax'), fees: sum(rows, 'fees'), total: sum(rows, 'total') };
      return {
        rows,
        totals: { period: 'Total', hotel: '', ...t, rate: pct(t.tax, t.taxable) },
        summary: [
          { label: 'Taxable value', value: t.taxable, type: 'money' },
          { label: 'Tax collected', value: t.tax, type: 'money' },
          { label: 'Effective rate', value: pct(t.tax, t.taxable), type: 'percent' },
          { label: 'Invoices', value: t.bookings, type: 'int' },
        ],
      };
    },
  },

  // ================================================================ Marketing
  {
    key: 'coupon-performance',
    name: 'Coupon performance',
    category: 'Marketing',
    audience: 'internal',
    description: 'What each coupon cost and earned: redemptions, discount given, revenue brought in and return per ₹ of discount.',
    filters: [F.dateRange, F.dateBasis(), F.hotel()],
    defaultRange: 'last90',
    columns: [
      { key: 'code', label: 'Coupon', type: 'text' },
      { key: 'offer', label: 'Offer', type: 'text' },
      { key: 'uses', label: 'Redemptions', type: 'int' },
      { key: 'discount', label: 'Discount given', type: 'money' },
      { key: 'revenue', label: 'Revenue', type: 'money' },
      { key: 'avg_discount', label: 'Avg discount', type: 'money' },
      { key: 'roi', label: 'Revenue per ₹1', type: 'decimal' },
    ],
    async run(p) {
      const list = await revenueBookings(p).join('coupons', 'coupons.id', 'bookings.coupon_id')
        .groupBy('coupons.id', 'coupons.code', 'coupons.discount_type', 'coupons.discount_value', 'coupons.max_discount')
        .select('coupons.code', 'coupons.discount_type', 'coupons.discount_value', 'coupons.max_discount')
        .select(db.raw('count(*)::int as uses'), db.raw('sum(bookings.discount_amount) as discount'), db.raw('sum(bookings.total_amount) as revenue'));
      const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
      const rows = list.map((c) => ({
        code: c.code,
        offer: c.discount_type === 'percentage' ? `${Number(c.discount_value)}% off${c.max_discount ? ` (max ${inr(c.max_discount)})` : ''}` : `${inr(c.discount_value)} off`,
        uses: c.uses, discount: r2(c.discount), revenue: r2(c.revenue), avg_discount: div(c.discount, c.uses), roi: div(c.revenue, c.discount),
      })).sort((a, b) => b.revenue - a.revenue);
      const t = { uses: sum(rows, 'uses'), discount: sum(rows, 'discount'), revenue: sum(rows, 'revenue') };
      return {
        rows,
        totals: { code: 'Total', offer: '', ...t, avg_discount: div(t.discount, t.uses), roi: div(t.revenue, t.discount) },
        summary: [
          { label: 'Redemptions', value: t.uses, type: 'int' },
          { label: 'Discount given', value: t.discount, type: 'money' },
          { label: 'Revenue from coupons', value: t.revenue, type: 'money' },
          { label: 'Revenue per ₹1 discount', value: div(t.revenue, t.discount), type: 'decimal' },
        ],
        chart: { title: 'Revenue by coupon', type: 'money', data: rows.map((r) => ({ label: r.code, value: r.revenue })) },
      };
    },
  },

  // ================================================================ Customer statements
  {
    key: 'customer-summary',
    name: 'Customer summary',
    category: 'Customers & statements',
    audience: 'internal',
    description: 'Your guests ranked by spend, with stays, room nights, first and last stay — spot repeat and high-value customers.',
    filters: [F.dateRange, F.dateBasis(), F.hotel()],
    defaultRange: 'last365',
    columns: [
      { key: 'name', label: 'Customer', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'bookings', label: 'Stays', type: 'int' },
      { key: 'room_nights', label: 'Room nights', type: 'int' },
      { key: 'spent', label: 'Total spent', type: 'money' },
      { key: 'avg_value', label: 'Avg per stay', type: 'money' },
      { key: 'first_stay', label: 'First stay', type: 'date' },
      { key: 'last_stay', label: 'Last stay', type: 'date' },
    ],
    async run(p) {
      const list = await revenueBookings(p).join('customers', 'customers.id', 'bookings.customer_id')
        .groupBy('customers.id', 'customers.name', 'customers.email', 'customers.phone')
        .select('customers.name', 'customers.email', 'customers.phone')
        .select(db.raw('count(*)::int as bookings'), db.raw('sum(bookings.nights * bookings.num_rooms)::int as room_nights'),
          db.raw('sum(bookings.total_amount) as spent'), db.raw('min(bookings.check_in) as first_stay'), db.raw('max(bookings.check_in) as last_stay'))
        .orderByRaw('sum(bookings.total_amount) desc');
      const rows = list.map((c) => ({
        name: c.name, email: c.email, phone: c.phone || '', bookings: c.bookings, room_nights: c.room_nights,
        spent: r2(c.spent), avg_value: div(c.spent, c.bookings), first_stay: c.first_stay, last_stay: c.last_stay,
      }));
      const repeat = rows.filter((r) => r.bookings > 1).length;
      return {
        rows,
        totals: { name: 'Total', bookings: sum(rows, 'bookings'), room_nights: sum(rows, 'room_nights'), spent: sum(rows, 'spent'), avg_value: div(sum(rows, 'spent'), sum(rows, 'bookings')) },
        summary: [
          { label: 'Customers', value: rows.length, type: 'int' },
          { label: 'Repeat customers', value: repeat, type: 'int' },
          { label: 'Repeat rate', value: pct(repeat, rows.length), type: 'percent' },
          { label: 'Avg spend per customer', value: div(sum(rows, 'spent'), rows.length), type: 'money' },
        ],
      };
    },
  },
  {
    key: 'guest-statement',
    name: 'Guest statement',
    category: 'Customers & statements',
    audience: 'guest',
    description: 'A statement for one guest — every booking with amounts paid and refunded. Download the PDF and send it to them.',
    filters: [F.customer, F.dateRange],
    defaultRange: 'last365',
    columns: [
      { key: 'ref', label: 'Reference', type: 'text' },
      { key: 'hotel', label: 'Hotel', type: 'text' },
      { key: 'check_in', label: 'Check-in', type: 'date' },
      { key: 'check_out', label: 'Check-out', type: 'date' },
      { key: 'nights', label: 'Nights', type: 'int' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'value', label: 'Booking value', type: 'money' },
      { key: 'paid', label: 'Paid', type: 'money' },
      { key: 'refunded', label: 'Refunded', type: 'money' },
      { key: 'net', label: 'Net paid', type: 'money' },
    ],
    async run(p) {
      const customer = await db('customers').where({ id: p.customerId }).first();
      if (!customer) return { rows: [], totals: null, summary: [], subject: 'Unknown customer' };
      let q = db('bookings').join('hotels', 'hotels.id', 'bookings.hotel_id').where('bookings.customer_id', p.customerId).whereRaw(NOT_ABANDONED);
      q = inRange(q, STAY_ON, p);
      const list = await q.select('bookings.*', 'hotels.name as hotel').orderBy('bookings.check_in', 'desc');
      const ids = list.map((b) => b.id);
      const [paid, refunded] = await Promise.all([paidByBooking(ids), refundsByBooking(ids)]);
      const rows = list.map((b) => ({
        ref: b.booking_ref ?? `#${b.id}`, hotel: b.hotel, check_in: b.check_in, check_out: b.check_out, nights: b.nights,
        status: label(b.booking_status), value: r2(b.total_amount), paid: r2(paid[b.id] ?? 0), refunded: r2(refunded[b.id] ?? 0),
        net: r2((paid[b.id] ?? 0) - (refunded[b.id] ?? 0)),
      }));
      const stays = list.filter((b) => REVENUE_STATUSES.includes(b.booking_status));
      return {
        rows,
        subject: `${customer.name} · ${customer.email}${customer.phone ? ` · ${customer.phone}` : ''}`,
        totals: { ref: 'Total', nights: sum(rows, 'nights'), value: sum(rows, 'value'), paid: sum(rows, 'paid'), refunded: sum(rows, 'refunded'), net: sum(rows, 'net') },
        summary: [
          { label: 'Stays', value: stays.length, type: 'int' },
          { label: 'Nights', value: stays.reduce((s, b) => s + b.nights, 0), type: 'int' },
          { label: 'Total paid', value: sum(rows, 'paid'), type: 'money' },
          { label: 'Refunded', value: sum(rows, 'refunded'), type: 'money' },
        ],
      };
    },
  },
  {
    key: 'partner-statement',
    name: 'Hotel partner statement',
    category: 'Customers & statements',
    audience: 'partner',
    description: 'A settlement statement for one hotel: every stay, amounts collected and refunded, your commission and the net payable to the property.',
    filters: [
      F.hotel(true), F.dateRange, F.dateBasis('stay'),
      { key: 'commissionPct', type: 'number', label: 'Commission %', default: 0, min: 0, max: 50, step: 0.5 },
    ],
    defaultRange: 'lastMonth',
    columns: [
      { key: 'ref', label: 'Reference', type: 'text' },
      { key: 'guest', label: 'Guest', type: 'text' },
      { key: 'check_in', label: 'Check-in', type: 'date' },
      { key: 'check_out', label: 'Check-out', type: 'date' },
      { key: 'nights', label: 'Nights', type: 'int' },
      { key: 'room_charges', label: 'Room charges', type: 'money' },
      { key: 'discount', label: 'Discount', type: 'money' },
      { key: 'taxes', label: 'Taxes & fees', type: 'money' },
      { key: 'collected', label: 'Collected', type: 'money' },
      { key: 'refunded', label: 'Refunded', type: 'money' },
      { key: 'commission', label: 'Commission', type: 'money' },
      { key: 'payable', label: 'Net payable', type: 'money' },
    ],
    async run(p) {
      const hotel = await db('hotels').where({ id: p.hotelId }).first();
      if (!hotel) return { rows: [], totals: null, summary: [], subject: 'Unknown hotel' };
      const list = await revenueBookings(p).leftJoin('customers', 'customers.id', 'bookings.customer_id')
        .select('bookings.*', 'customers.name as customer_name').orderBy('bookings.check_in');
      const refunds = await refundsByBooking(list.map((b) => b.id));
      const rate = Number(p.commissionPct) / 100;
      const rows = list.map((b) => {
        const refunded = r2(refunds[b.id] ?? 0);
        const commission = r2((Number(b.room_price) - Number(b.discount_amount)) * rate);
        return {
          ref: b.booking_ref ?? `#${b.id}`, guest: b.guest_name || b.customer_name || '—', check_in: b.check_in, check_out: b.check_out,
          nights: b.nights * b.num_rooms, room_charges: r2(b.room_price), discount: r2(b.discount_amount),
          taxes: r2(Number(b.tax_amount) + Number(b.fee_amount)), collected: r2(b.total_amount), refunded, commission,
          payable: r2(Number(b.total_amount) - refunded - commission),
        };
      });
      const keys = ['nights', 'room_charges', 'discount', 'taxes', 'collected', 'refunded', 'commission', 'payable'];
      const t = Object.fromEntries(keys.map((k) => [k, sum(rows, k)]));
      return {
        rows,
        subject: `${hotel.name}${hotel.city ? `, ${hotel.city}` : ''} · commission ${Number(p.commissionPct)}%`,
        totals: { ref: 'Total', ...t },
        summary: [
          { label: 'Stays', value: rows.length, type: 'int' },
          { label: 'Collected', value: t.collected, type: 'money' },
          { label: 'Commission', value: t.commission, type: 'money' },
          { label: 'Net payable to hotel', value: t.payable, type: 'money' },
        ],
      };
    },
  },
];

const REPORT_BY_KEY = Object.fromEntries(REPORTS.map((r) => [r.key, r]));

module.exports = { REPORTS, REPORT_BY_KEY, REVENUE_STATUSES };
