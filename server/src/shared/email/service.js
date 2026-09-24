const db = require('../../database/db');
const config = require('../../config');
const logger = require('../loggers/logger');
const { ApiError } = require('../../core/ApiError');
const { getTransporter, isMailConfigured } = require('../utils/mailer');
const { renderEmail } = require('./render');
const { bookingContext } = require('./context');
const { TEMPLATES, TEMPLATE_BY_KEY } = require('./defaults');

const SETTINGS_KEY = 'email_settings';
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// RFC 2606 / 6761 reserved names — seed and test accounts use these, and
// mail sent to them only bounces back into the sender's inbox.
const RESERVED_DOMAIN = /@(?:[^@]+\.)?(example\.(com|net|org)|[^@]+\.(test|invalid|example|localhost))$/i;
const isReservedAddress = (to) => RESERVED_DOMAIN.test(String(to).trim());

const DEFAULT_SETTINGS = {
  adminRecipients: [],
  guestFromName: 'Stay Farer',
  adminFromName: 'Stayfarer Admin',
  replyTo: '',
};

function globals() {
  return {
    brand_name: 'Stay Farer',
    site_url: config.email.siteUrl,
    admin_url: config.email.adminUrl,
    support_email: config.email.supportEmail,
    year: String(new Date().getFullYear()),
  };
}

async function getEmailSettings() {
  const row = await db('settings').where({ key: SETTINGS_KEY }).first();
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

async function saveEmailSettings(input) {
  const current = await getEmailSettings();
  const recipients = Array.isArray(input.adminRecipients)
    ? input.adminRecipients
    : String(input.adminRecipients ?? '').split(/[,\n;]/);
  const cleaned = [...new Set(recipients.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  const invalid = cleaned.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) throw ApiError.badRequest(`Not a valid email address: ${invalid.join(', ')}`);
  const replyTo = String(input.replyTo ?? current.replyTo ?? '').trim();
  if (replyTo && !EMAIL_RE.test(replyTo)) throw ApiError.badRequest('Reply-to must be a valid email address');
  const next = {
    adminRecipients: cleaned.slice(0, 20),
    guestFromName: String(input.guestFromName ?? current.guestFromName).trim().slice(0, 60) || DEFAULT_SETTINGS.guestFromName,
    adminFromName: String(input.adminFromName ?? current.adminFromName).trim().slice(0, 60) || DEFAULT_SETTINGS.adminFromName,
    replyTo,
  };
  await db('settings')
    .insert({ key: SETTINGS_KEY, value: JSON.stringify(next), updated_at: new Date() })
    .onConflict('key')
    .merge({ value: JSON.stringify(next), updated_at: new Date() });
  return next;
}

/** Inserts any default template that doesn't exist yet. Never touches edited ones. */
async function ensureDefaultTemplates() {
  const rows = TEMPLATES.map(({ key, kind, audience, name, description, subject, html }) => ({
    key, kind, audience, name, description, subject, html,
  }));
  const inserted = await db('email_templates').insert(rows).onConflict('key').ignore().returning('key');
  if (inserted.length) logger.info(`Seeded ${inserted.length} default email template(s)`);
}

async function loadPair(key) {
  const template = (await db('email_templates').where({ key, kind: 'email' }).first()) ?? null;
  const def = TEMPLATE_BY_KEY[key];
  const t = template ?? (def && def.kind === 'email' ? def : null);
  if (!t) throw new Error(`Unknown email template "${key}"`);
  const layoutKey = `layout_${t.audience}`;
  const layout = (await db('email_templates').where({ key: layoutKey }).first()) ?? TEMPLATE_BY_KEY[layoutKey];
  return { template: t, layout, stored: !!template };
}

/**
 * Renders `key` with `data`. Required templates (the admin OTP) fall back to
 * the built-in default if the stored version fails, so a bad edit can never
 * lock admins out.
 */
async function renderTemplate(key, data) {
  const { template, layout } = await loadPair(key);
  const vars = { ...globals(), ...data };
  try {
    return { ...renderEmail({ template, layout, data: vars }), template };
  } catch (err) {
    const def = TEMPLATE_BY_KEY[key];
    if (!def?.required) throw err;
    logger.error(`Template ${key} failed to render, using default: ${err.message}`);
    return { ...renderEmail({ template: def, layout: TEMPLATE_BY_KEY[`layout_${def.audience}`], data: vars }), template: def };
  }
}

async function deliver({ to, audience, subject, html, text }) {
  const settings = await getEmailSettings();
  const fromName = audience === 'admin' ? settings.adminFromName : settings.guestFromName;
  await getTransporter().sendMail({
    from: `"${fromName.replace(/"/g, '')}" <${config.mail.user}>`,
    to,
    replyTo: audience === 'guest' ? settings.replyTo || config.email.supportEmail : undefined,
    subject,
    html,
    text,
  });
}

/**
 * Sends immediately (used for the admin OTP and test sends) and records the
 * attempt in the delivery log. `logData` replaces `data` in the log so
 * secrets like the OTP are never stored.
 */
async function sendNow(key, to, data, { logData = data, logSubject, entityType = null, entityId = null, force = false, subjectPrefix = '' } = {}) {
  const rendered = await renderTemplate(key, data);
  if (subjectPrefix) rendered.subject = `${subjectPrefix} ${rendered.subject}`;
  const disabled = (rendered.template.is_enabled === false || !!rendered.template.deleted_at) && !TEMPLATE_BY_KEY[key]?.required;
  const log = {
    template_key: key, to_email: to, data: JSON.stringify(logData ?? {}), subject: logSubject ?? rendered.subject,
    related_entity_type: entityType, related_entity_id: entityId != null ? String(entityId) : null, attempts: 1,
  };
  if (disabled && !force) {
    const reason = rendered.template.deleted_at ? 'Template was deleted' : 'Template is switched off';
    await db('email_outbox').insert({ ...log, status: 'skipped', last_error: reason });
    return { skipped: true };
  }
  if (isReservedAddress(to)) {
    await db('email_outbox').insert({ ...log, status: 'skipped', last_error: 'Reserved test domain — not sent' });
    return { skipped: true, subject: rendered.subject };
  }
  try {
    await deliver({ to, audience: rendered.template.audience, ...rendered });
    await db('email_outbox').insert({ ...log, status: 'sent', sent_at: db.fn.now() });
    logger.info(`Email ${key} sent to ${to}`);
    return { sent: true, subject: rendered.subject };
  } catch (err) {
    await db('email_outbox').insert({ ...log, status: 'failed', last_error: String(err.message).slice(0, 1000) });
    throw err;
  }
}

/**
 * Delivers an already-rendered email (used for test sends of unsaved drafts)
 * and records it in the delivery log. Reserved test domains are refused.
 */
async function sendRendered({ key, to, audience, subject, html, text, logData = {} }) {
  const log = { template_key: key, to_email: to, data: JSON.stringify(logData), subject, attempts: 1 };
  if (isReservedAddress(to)) {
    await db('email_outbox').insert({ ...log, status: 'skipped', last_error: 'Reserved test domain — not sent' });
    return { skipped: true, subject };
  }
  try {
    await deliver({ to, audience, subject, html, text });
    await db('email_outbox').insert({ ...log, status: 'sent', sent_at: db.fn.now() });
    return { sent: true, subject };
  } catch (err) {
    await db('email_outbox').insert({ ...log, status: 'failed', last_error: String(err.message).slice(0, 1000) });
    throw err;
  }
}

/** Queues an email for the worker. Pass a transaction to commit it atomically with the change that caused it. */
async function enqueue(trxOrDb, { templateKey, to, data = {}, entityType = null, entityId = null }) {
  if (!to || !EMAIL_RE.test(to)) return 0;
  await trxOrDb('email_outbox').insert({
    template_key: templateKey, to_email: to, data: JSON.stringify(data),
    related_entity_type: entityType, related_entity_id: entityId != null ? String(entityId) : null,
  });
  return 1;
}

let warnedNoMail = false;

/**
 * Sends due rows from email_outbox. Rows are claimed with SKIP LOCKED so two
 * admin servers never send the same email; failures back off exponentially
 * (2, 4, 8, 16 min) and give up after MAX_ATTEMPTS.
 */
async function processOutbox(limit = 10) {
  if (!isMailConfigured()) {
    if (!warnedNoMail) logger.warn('Email is not configured (EMAIL_USER / EMAIL_APP_PASSWORD) — queued emails will wait.');
    warnedNoMail = true;
    return 0;
  }
  warnedNoMail = false;

  return db.transaction(async (trx) => {
    const rows = await trx('email_outbox')
      .where('status', 'pending')
      .where('send_after', '<=', trx.fn.now())
      .orderBy('id')
      .limit(limit)
      .forUpdate()
      .skipLocked();

    for (const row of rows) {
      const attempts = row.attempts + 1;
      try {
        if (isReservedAddress(row.to_email)) {
          await trx('email_outbox').where({ id: row.id }).update({ status: 'skipped', last_error: 'Reserved test domain — not sent', attempts, updated_at: trx.fn.now() });
          continue;
        }
        const stored = await trx('email_templates').where({ key: row.template_key }).first();
        if (stored && (!stored.is_enabled || stored.deleted_at) && !TEMPLATE_BY_KEY[row.template_key]?.required) {
          const reason = stored.deleted_at ? 'Template was deleted' : 'Template is switched off';
          await trx('email_outbox').where({ id: row.id }).update({ status: 'skipped', last_error: reason, attempts, updated_at: trx.fn.now() });
          continue;
        }
        const data = row.data ?? {};
        const context = data.bookingId ? await bookingContext(data.bookingId) : {};
        const rendered = await renderTemplate(row.template_key, { ...context, ...data });
        await deliver({ to: row.to_email, audience: rendered.template.audience, ...rendered });
        await trx('email_outbox').where({ id: row.id }).update({
          status: 'sent', subject: rendered.subject, attempts, sent_at: trx.fn.now(), last_error: null, updated_at: trx.fn.now(),
        });
      } catch (err) {
        const giveUp = attempts >= MAX_ATTEMPTS;
        await trx('email_outbox').where({ id: row.id }).update({
          status: giveUp ? 'failed' : 'pending',
          attempts,
          last_error: String(err.message).slice(0, 1000),
          send_after: new Date(Date.now() + 2 ** attempts * 60 * 1000),
          updated_at: trx.fn.now(),
        });
        logger.error(`Email #${row.id} (${row.template_key}) to ${row.to_email} failed (attempt ${attempts}): ${err.message}`);
      }
    }
    return rows.length;
  });
}

/** Queues tomorrow's check-in reminders (once per booking). */
async function queueCheckinReminders() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const due = await db('bookings')
    .leftJoin('customers', 'customers.id', 'bookings.customer_id')
    .where('bookings.booking_status', 'confirmed')
    .where('bookings.check_in', tomorrow)
    .whereNotExists(
      db('email_outbox')
        .where('template_key', 'checkin_reminder')
        .where('related_entity_type', 'booking')
        .whereRaw('related_entity_id = bookings.id::text')
    )
    .select('bookings.id', db.raw('coalesce(bookings.guest_email, customers.email) as email'));
  let n = 0;
  for (const b of due) {
    n += await enqueue(db, { templateKey: 'checkin_reminder', to: b.email, data: { bookingId: b.id }, entityType: 'booking', entityId: b.id });
  }
  if (n) logger.info(`Queued ${n} check-in reminder(s)`);
  return n;
}

function startEmailWorker() {
  ensureDefaultTemplates().catch((err) => logger.error(`Seeding email templates failed: ${err.message}`));
  const tick = () => processOutbox().catch((err) => logger.error(`Email worker failed: ${err.message}`));
  const reminders = () => queueCheckinReminders().catch((err) => logger.error(`Reminder scan failed: ${err.message}`));
  setTimeout(tick, 3000).unref();
  setInterval(tick, 15 * 1000).unref();
  setTimeout(reminders, 10 * 1000).unref();
  setInterval(reminders, 60 * 60 * 1000).unref();
}

module.exports = {
  isReservedAddress,
  globals,
  getEmailSettings,
  saveEmailSettings,
  ensureDefaultTemplates,
  renderTemplate,
  sendNow,
  sendRendered,
  enqueue,
  startEmailWorker,
};
