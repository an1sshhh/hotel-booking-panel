const nodemailer = require('nodemailer');
const config = require('../../config');

let transporter = null;

const useGmailScript = () => Boolean(config.mail.scriptUrl);

function isMailConfigured() {
  return useGmailScript() ? Boolean(config.mail.scriptSecret) : Boolean(config.mail.user && config.mail.appPassword);
}

/** "Name" <a@b.c> → { name, email } */
function parseAddress(value) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(String(value));
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(value).trim() };
}

/**
 * Sends through the Google Apps Script web app in scripts/gmail-relay.gs over HTTPS
 * (port 443) — for hosts that block outbound SMTP, like Render's free plan. The mail
 * still goes out from the Gmail account that owns the script. Same shape as nodemailer's sendMail.
 */
const gmailScriptTransport = {
  async sendMail({ from, to, replyTo, subject, html, text }) {
    const res = await fetch(config.mail.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: config.mail.scriptSecret,
        to: parseAddress(to).email,
        name: parseAddress(from).name,
        ...(replyTo ? { replyTo: parseAddress(replyTo).email } : {}),
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(60000), // Apps Script cold starts can take ~20s
    });
    const body = await res.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      // Google answers with an HTML page when the URL is wrong or the web app isn't open to "Anyone".
      throw new Error(`Gmail relay returned ${res.status} (not JSON) — check GMAIL_SCRIPT_URL and that the web app's access is "Anyone"`);
    }
    if (!data.ok) throw new Error(`Gmail relay: ${data.error}`);
    return data;
  },
};

function getTransporter() {
  if (!isMailConfigured()) {
    throw new Error('Email is not configured: set GMAIL_SCRIPT_URL + GMAIL_SCRIPT_SECRET, or EMAIL_USER + EMAIL_APP_PASSWORD');
  }
  if (useGmailScript()) return gmailScriptTransport;
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
