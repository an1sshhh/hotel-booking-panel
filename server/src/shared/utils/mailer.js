const nodemailer = require('nodemailer');
const config = require('../../config');

let transporter = null;

function isMailConfigured() {
  return Boolean(config.mail.user && config.mail.appPassword);
}

function getTransporter() {
  if (!isMailConfigured()) {
    throw new Error('EMAIL_USER and EMAIL_APP_PASSWORD must be set to send email');
  }
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
