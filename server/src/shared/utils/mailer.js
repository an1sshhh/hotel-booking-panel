const nodemailer = require('nodemailer');
const config = require('../../config');

let transporter = null;

const useBrevo = () => Boolean(config.mail.brevoApiKey);

function isMailConfigured() {
  return useBrevo() ? Boolean(config.mail.from) : Boolean(config.mail.user && config.mail.appPassword);
}

/** "Name" <a@b.c> → { name, email } */
function parseAddress(value) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(String(value));
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(value).trim() };
}

/**
 * Brevo transactional email over HTTPS (port 443) — works where outbound SMTP
 * is blocked. Accepts the same message shape as nodemailer's sendMail.
 */
const brevoTransport = {
  async sendMail({ from, to, replyTo, subject, html, text }) {
    const sender = parseAddress(from);
    sender.email = config.mail.from; // Brevo only sends from a verified sender
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.mail.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender,
        to: [parseAddress(to)],
        ...(replyTo ? { replyTo: parseAddress(replyTo) } : {}),
        subject,
        htmlContent: html,
        ...(text ? { textContent: text } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json().catch(() => ({}));
  },
};

function getTransporter() {
  if (!isMailConfigured()) {
    throw new Error('Email is not configured: set BREVO_API_KEY + EMAIL_FROM, or EMAIL_USER + EMAIL_APP_PASSWORD');
  }
  if (useBrevo()) return brevoTransport;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.mail.user, pass: config.mail.appPassword },
    });
  }
  return transporter;
}

/**
 * Admin login code, rendered from the editable "admin_login_otp" template.
 * Sent synchronously so login fails loudly if mail is down; the code itself
 * is never written to the delivery log.
 */
async function sendOtpEmail(email, otp, { name, expiresMinutes = 5 } = {}) {
  // Required lazily: the email service depends on this module for the transport.
  const { sendNow } = require('../email/service');
  await sendNow(
    'admin_login_otp',
    email,
    { admin_name: name || 'there', otp, expires_minutes: String(expiresMinutes) },
    // The code must never be readable from the delivery log — neither in data nor in the subject.
    { logData: { otp: '••••••' }, logSubject: 'Admin login code (redacted)' }
  );
}

module.exports = { getTransporter, isMailConfigured, sendOtpEmail };
