const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');
const { logAction } = require('../../shared/utils/audit');
const { renderEmail, renderString } = require('../../shared/email/render');
const { TEMPLATES, TEMPLATE_BY_KEY, BOOKING_VARIABLES } = require('../../shared/email/defaults');
const { bookingContext } = require('../../shared/email/context');
const email = require('../../shared/email/service');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 50;
// Which real email each layout is previewed with.
const LAYOUT_PREVIEW = { layout_guest: 'booking_confirmed', layout_admin: 'admin_new_booking' };

const CUSTOM_STARTER = `<h1>Hello {{guest_name}},</h1>
<p>Write your message here. Placeholders like {{hotel_name}} or {{booking_ref}} are filled in when you send it for a booking.</p>
<div class="panel">
  <p style="margin:0;">Panels, buttons and tables pick up the layout's styles automatically.</p>
</div>
<p style="text-align:center;margin:24px 0 8px;"><a class="btn" href="{{site_url}}">Visit {{brand_name}}</a></p>`;

async function ensureSeeded() {
  const [{ count }] = await db('email_templates').where({ is_custom: false }).count({ count: '*' });
  if (Number(count) < TEMPLATES.length) await email.ensureDefaultTemplates();
}

async function stored(key) {
  let row = await db('email_templates').where({ key }).first();
  if (!row && TEMPLATE_BY_KEY[key]) {
    await email.ensureDefaultTemplates();
    row = await db('email_templates').where({ key }).first();
  }
  if (!row) throw ApiError.notFound('Email template not found');
  return row;
}

/**
 * The rules for a template: built-ins come from defaults.js; custom ones from
 * their DB row. Custom emails can be sent for a booking, so they preview with
 * booking sample data.
 */
function definitionFor(row) {
  if (!row.is_custom) {
    const def = TEMPLATE_BY_KEY[row.key];
    if (!def) throw ApiError.notFound('Email template not found');
    return { ...def, custom: false };
  }
  return { key: row.key, kind: 'email', audience: row.audience, name: row.name, required: false, custom: true, variables: BOOKING_VARIABLES };
}

function sampleFor(def) {
  return { ...email.globals(), ...Object.fromEntries(def.variables.map((v) => [v.name, v.sample ?? ''])) };
}

async function listTemplates() {
  await ensureSeeded();
  const [rows, stats] = await Promise.all([
    db('email_templates').select('key', 'kind', 'audience', 'name', 'description', 'subject', 'is_enabled', 'is_custom', 'created_at', 'deleted_at'),
    db('email_outbox')
      .where('created_at', '>=', db.raw("now() - interval '30 days'"))
      .groupBy('template_key')
      .select('template_key')
      .select(db.raw("count(*) filter (where status = 'sent')::int as sent"))
      .select(db.raw("count(*) filter (where status = 'failed')::int as failed")),
  ]);
  const statsByKey = Object.fromEntries(stats.map((s) => [s.template_key, s]));
  const order = TEMPLATES.map((t) => t.key);
  const rank = (r) => (r.is_custom ? 1000 : order.indexOf(r.key));
  return rows
    .map(({ deleted_at, created_at, ...r }) => ({
      ...r,
      deleted: !!deleted_at,
      deletable: !TEMPLATE_BY_KEY[r.key]?.required && r.kind !== 'layout',
      required: !!TEMPLATE_BY_KEY[r.key]?.required,
      stats: { sent: statsByKey[r.key]?.sent ?? 0, failed: statsByKey[r.key]?.failed ?? 0 },
      created_at,
    }))
    .sort((a, b) => rank(a) - rank(b) || String(a.created_at).localeCompare(String(b.created_at)))
    .map(({ created_at, ...r }) => r);
}

async function getTemplate(key) {
  const row = await stored(key);
  return { ...row, required: !!definitionFor(row).required };
}

function validateDraft(def, { subject, html }) {
  if (typeof html !== 'string' || !html.trim()) throw ApiError.badRequest('HTML body is required');
  if (html.length > 200000) throw ApiError.badRequest('HTML body is too large (200 KB max)');
  if (def.kind === 'layout' && !/\{\{\{\s*content\s*\}\}\}/.test(html)) {
    throw ApiError.badRequest('A layout must keep the {{{content}}} placeholder, or emails will have no body');
  }
  if (def.kind === 'email') {
    if (typeof subject !== 'string' || !subject.trim()) throw ApiError.badRequest('Subject is required');
    if (subject.length > 255) throw ApiError.badRequest('Subject must be 255 characters or fewer');
  }
  if (/<script[\s>]/i.test(html)) throw ApiError.badRequest('Scripts are not allowed in emails (mail clients strip them)');
  try {
    renderString(html, {});
  } catch (err) {
    throw ApiError.badRequest(`Template could not be rendered: ${err.message}`);
  }
}

/**
 * Renders a draft (unsaved) template with sample data for the live preview.
 * Layouts are previewed wrapped around a representative email of the same audience.
 */
async function preview(key, { subject, html } = {}) {
  const row = await stored(key);
  const def = definitionFor(row);
  const draft = { subject: subject ?? row.subject, html: html ?? row.html };

  let template;
  let layout;
  let vars;
  if (def.kind === 'layout') {
    template = await db('email_templates').where({ key: LAYOUT_PREVIEW[key] }).first();
    layout = { html: draft.html };
    vars = sampleFor(definitionFor(template));
  } else {
    template = { ...row, ...draft };
    const layoutRow = await db('email_templates').where({ key: `layout_${def.audience}` }).first();
    layout = { html: layoutRow?.html ?? TEMPLATE_BY_KEY[`layout_${def.audience}`].html };
    vars = sampleFor(def);
  }

  try {
    return renderEmail({ template, layout, data: vars });
  } catch (err) {
    throw ApiError.badRequest(`Template could not be rendered: ${err.message}`);
  }
}

function slugify(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'template';
}

/** Creates a custom template — blank (starter body) or duplicated from any existing email. */
async function createTemplate(body, adminUserId) {
  const name = String(body.name ?? '').trim();
  if (!name) throw ApiError.badRequest('Give the template a name');
  if (name.length > 120) throw ApiError.badRequest('Name must be 120 characters or fewer');

  let source = null;
  if (body.duplicateFrom) {
    source = await stored(body.duplicateFrom);
    if (source.kind !== 'email') throw ApiError.badRequest('Only emails can be duplicated, not layouts');
  }
  const audience = body.audience ?? source?.audience ?? 'guest';
  if (!['guest', 'admin'].includes(audience)) throw ApiError.badRequest('Audience must be guest or admin');

  const draft = {
    subject: String(source?.subject ?? `A message from {{brand_name}}`).trim(),
    html: source?.html ?? CUSTOM_STARTER,
  };
  validateDraft({ kind: 'email' }, draft);

  const base = `custom_${slugify(name)}`;
  let key = base;
  for (let i = 2; await db('email_templates').where({ key }).first(); i++) key = `${base}_${i}`;

  await db('email_templates').insert({
    key,
    kind: 'email',
    audience,
    name,
    description: source ? `Copy of “${source.name}”.` : 'Custom email, sent manually from the admin panel.',
    subject: draft.subject,
    html: draft.html,
    is_custom: true,
    is_enabled: true,
    created_by: adminUserId ?? null,
    updated_by: adminUserId ?? null,
  });
  await logAction({ adminUserId, action: 'email_template.created', entityType: 'email_template', entityId: key, after: { name, audience } });
  return getTemplate(key);
}

async function updateTemplate(key, body, adminUserId) {
  const before = await stored(key);
  if (before.deleted_at) throw ApiError.badRequest('This template is deleted — restore it before editing');
  const def = definitionFor(before);
  const changes = {};

  if (body.html !== undefined || body.subject !== undefined) {
    const draft = { subject: body.subject ?? before.subject, html: body.html ?? before.html };
    validateDraft(def, draft);
    changes.html = draft.html;
    if (def.kind === 'email') changes.subject = draft.subject.trim();
  }
  if (body.isEnabled !== undefined) {
    if (def.required && !body.isEnabled) throw ApiError.badRequest(`"${def.name}" is required and can’t be switched off`);
    if (def.kind === 'layout' && !body.isEnabled) throw ApiError.badRequest('Layouts can’t be switched off');
    changes.is_enabled = !!body.isEnabled;
  }
  if (before.is_custom && body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 120) throw ApiError.badRequest('Name must be 1–120 characters');
    changes.name = name;
  }
  if (!Object.keys(changes).length) return getTemplate(key);

  await db('email_templates').where({ key }).update({ ...changes, updated_by: adminUserId ?? null, updated_at: db.fn.now() });
  await logAction({
    adminUserId, action: 'email_template.updated', entityType: 'email_template', entityId: key,
    before: { subject: before.subject, is_enabled: before.is_enabled }, after: { subject: changes.subject, is_enabled: changes.is_enabled },
  });
  return getTemplate(key);
}

async function resetTemplate(key, adminUserId) {
  const row = await stored(key);
  if (row.is_custom) throw ApiError.badRequest('Custom templates have no default to reset to');
  const def = TEMPLATE_BY_KEY[key];
  await db('email_templates').where({ key }).update({
    subject: def.subject, html: def.html, name: def.name, description: def.description, is_enabled: true,
    updated_by: adminUserId ?? null, updated_at: db.fn.now(),
  });
  await logAction({ adminUserId, action: 'email_template.reset', entityType: 'email_template', entityId: key });
  return getTemplate(key);
}

/**
 * Soft-deletes a template: it drops out of the list and stops being sent,
 * but can be restored. The admin login code and the two layouts are
 * protected — without them admins couldn't sign in, or no email would render.
 */
async function deleteTemplate(key, adminUserId) {
  const row = await stored(key);
  if (TEMPLATE_BY_KEY[key]?.required) throw ApiError.badRequest('The admin login code email can’t be deleted — without it nobody could sign in');
  if (row.kind === 'layout') throw ApiError.badRequest('Layouts can’t be deleted — every email of this theme is built on it');
  if (row.deleted_at) return;
  const [{ pending }] = await db('email_outbox').where({ template_key: key, status: 'pending' }).count({ pending: '*' });
  if (Number(pending)) throw ApiError.badRequest(`${pending} email(s) using this template are still queued — wait for them to send first`);
  await db('email_templates').where({ key }).update({ deleted_at: db.fn.now(), deleted_by: adminUserId ?? null, updated_at: db.fn.now() });
  await logAction({ adminUserId, action: 'email_template.deleted', entityType: 'email_template', entityId: key, before: { name: row.name } });
}

async function restoreTemplate(key, adminUserId) {
  const row = await stored(key);
  if (!row.deleted_at) return getTemplate(key);
  await db('email_templates').where({ key }).update({ deleted_at: null, deleted_by: null, updated_by: adminUserId ?? null, updated_at: db.fn.now() });
  await logAction({ adminUserId, action: 'email_template.restored', entityType: 'email_template', entityId: key });
  return getTemplate(key);
}

/**
 * Sends a test to one address, filled with sample data. Uses the editor's
 * current (possibly unsaved) subject/HTML when given, else the saved version
 * from the database — the same rendering path real emails take.
 */
async function sendTest(key, to, draft = {}, adminUserId) {
  const row = await stored(key);
  const def = definitionFor(row);
  if (!to || !EMAIL_RE.test(to)) throw ApiError.badRequest('Enter a valid email address for the test');
  if (email.isReservedAddress(to)) {
    throw ApiError.badRequest(`${to} is a reserved test domain and can't receive mail — use a real address`);
  }
  const rendered = await preview(key, { subject: draft.subject, html: draft.html });
  const sendKey = def.kind === 'layout' ? LAYOUT_PREVIEW[key] : key;
  try {
    const result = await email.sendRendered({
      key: sendKey, to, audience: def.audience, subject: `[Test] ${rendered.subject}`, html: rendered.html, text: rendered.text,
      logData: { test: true, by: adminUserId, draft: draft.html !== undefined },
    });
    return { to, subject: result.subject };
  } catch (err) {
    throw ApiError.unavailable(`Test email failed: ${err.message}`, 502);
  }
}

/**
 * Queues a custom template for real recipients: a list of addresses, and/or
 * the guest of a booking (booking variables are then filled from that booking).
 * Goes through the outbox, so it's retried and appears in the delivery log.
 */
async function sendTemplate(key, body, adminUserId) {
  const row = await stored(key);
  const def = definitionFor(row);
  if (!def.custom) throw ApiError.badRequest('Built-in emails are sent automatically by the system; only custom templates can be sent manually');
  if (row.deleted_at) throw ApiError.badRequest('This template is deleted — restore it before sending');
  if (!row.is_enabled) throw ApiError.badRequest('This template is switched off — switch it on to send it');

  const recipients = [];
  let booking = null;
  if (body.bookingId) {
    booking = await bookingContext(Number(body.bookingId));
    if (!booking) throw ApiError.badRequest('Booking not found');
    if (!booking.guest_email) throw ApiError.badRequest('That booking has no guest email address');
    recipients.push(booking.guest_email);
  }
  const listed = Array.isArray(body.recipients) ? body.recipients : String(body.recipients ?? '').split(/[,\n;]/);
  for (const r of listed.map((e) => String(e).trim().toLowerCase()).filter(Boolean)) {
    if (!EMAIL_RE.test(r)) throw ApiError.badRequest(`Not a valid email address: ${r}`);
    recipients.push(r);
  }
  const unique = [...new Set(recipients)];
  if (!unique.length) throw ApiError.badRequest('Add at least one recipient or pick a booking');
  if (unique.length > MAX_RECIPIENTS) throw ApiError.badRequest(`Send to at most ${MAX_RECIPIENTS} recipients at a time`);

  const data = { ...(booking ? { bookingId: booking.booking_id } : {}), sent_by: adminUserId ?? null };
  let queued = 0;
  const skipped = [];
  await db.transaction(async (trx) => {
    for (const to of unique) {
      if (email.isReservedAddress(to)) {
        skipped.push(to);
        continue;
      }
      queued += await email.enqueue(trx, {
        templateKey: key, to, data,
        entityType: booking ? 'booking' : null, entityId: booking ? booking.booking_id : null,
      });
    }
  });
  await logAction({ adminUserId, action: 'email_template.sent', entityType: 'email_template', entityId: key, after: { queued, skipped: skipped.length } });
  return { queued, skipped };
}

async function listOutbox({ templateKey, status, page = 1, pageSize = 25 }) {
  const size = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const pageNo = Math.max(1, Number(page) || 1);
  let q = db('email_outbox');
  if (templateKey) q = q.where({ template_key: templateKey });
  const counts = await q.clone().groupBy('status').select('status').count({ count: '*' });
  if (status) q = q.where({ status });
  const [{ count }] = await q.clone().count({ count: '*' });
  const rows = await q
    .select('id', 'template_key', 'to_email', 'status', 'attempts', 'last_error', 'subject', 'related_entity_type', 'related_entity_id', 'send_after', 'sent_at', 'created_at')
    .orderBy('id', 'desc')
    .limit(size)
    .offset((pageNo - 1) * size);
  return {
    data: rows,
    total: Number(count),
    page: pageNo,
    pageSize: size,
    counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.count)])),
  };
}

/** Re-renders a logged email with its stored data (booking details are re-read). */
async function viewOutbox(id) {
  const row = await db('email_outbox').where({ id }).first();
  if (!row) throw ApiError.notFound('Email not found');
  const exists = await db('email_templates').where({ key: row.template_key }).first();
  if (!exists) throw ApiError.badRequest('The template for this email has since been deleted');
  const data = row.data ?? {};
  const context = data.bookingId ? (await bookingContext(data.bookingId)) ?? {} : {};
  const rendered = await email.renderTemplate(row.template_key, { ...context, ...data });
  return {
    ...rendered,
    template: undefined,
    subject: row.subject ?? rendered.subject,
    to: row.to_email,
    status: row.status,
    note: row.template_key === 'admin_login_otp' ? 'Login codes are never stored — the code is masked here.' : 'Rendered with the current template and this email’s data.',
  };
}

async function retryOutbox(id) {
  const [row] = await db('email_outbox')
    .where({ id })
    .whereIn('status', ['failed', 'skipped'])
    .update({ status: 'pending', send_after: db.fn.now(), attempts: 0, last_error: null, updated_at: db.fn.now() })
    .returning('*');
  if (!row) throw ApiError.badRequest('Only failed or skipped emails can be retried');
  return row;
}

module.exports = {
  listTemplates, getTemplate, preview, createTemplate, updateTemplate, resetTemplate, deleteTemplate, restoreTemplate,
  sendTest, sendTemplate, listOutbox, viewOutbox, retryOutbox,
  getSettings: email.getEmailSettings,
  saveSettings: email.saveEmailSettings,
};
