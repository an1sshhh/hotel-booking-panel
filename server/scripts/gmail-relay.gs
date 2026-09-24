/**
 * Gmail relay for the Stayfarer admin API.
 *
 * Render's free plan blocks SMTP, so the API posts each email here over HTTPS and
 * this script sends it from your Gmail account (~100 emails/day on a personal account).
 *
 * Setup: script.google.com -> New project -> paste this file -> set SECRET below
 * (same value as GMAIL_SCRIPT_SECRET on the server) -> Deploy -> New deployment ->
 * type "Web app", Execute as "Me", Who has access "Anyone" -> copy the /exec URL
 * into GMAIL_SCRIPT_URL. After editing the script, deploy a new version
 * (Deploy -> Manage deployments -> edit -> Version: New version) to keep the same URL.
 */
const SECRET = 'PASTE_THE_SAME_SECRET_AS_GMAIL_SCRIPT_SECRET';

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'Invalid JSON' });
  }
  if (!SECRET || SECRET.indexOf('PASTE_') === 0 || req.secret !== SECRET) {
    return reply({ ok: false, error: 'Unauthorized' });
  }
  try {
    const message = { to: req.to, subject: req.subject, htmlBody: req.html, body: req.text || '' };
    if (req.name) message.name = req.name;
    if (req.replyTo) message.replyTo = req.replyTo;
    MailApp.sendEmail(message);
    return reply({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function reply(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
