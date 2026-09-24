const { ApiResponse } = require('../../core/ApiResponse');
const service = require('./service');
const config = require('../../config');
const { isMailConfigured } = require('../../shared/utils/mailer');

const handle = (fn) => async (req, res, next) => {
  try {
    ApiResponse.success(res, { data: await fn(req) });
  } catch (err) {
    next(err);
  }
};

/** Read-only facts about the mail setup, shown on the Settings tab. */
function deliveryInfo() {
  return { mailConfigured: isMailConfigured(), senderAddress: config.mail.from || null, emailProvider: config.mail.brevoApiKey ? 'Brevo' : 'Gmail SMTP', siteUrl: config.email.siteUrl, supportEmail: config.email.supportEmail };
}

module.exports = {
  list: handle(() => service.listTemplates()),
  get: handle((req) => service.getTemplate(req.params.key)),
  update: handle((req) => service.updateTemplate(req.params.key, req.body, req.user.sub)),
  preview: handle((req) => service.preview(req.params.key, req.body)),
  reset: handle((req) => service.resetTemplate(req.params.key, req.user.sub)),
  create: handle((req) => service.createTemplate(req.body ?? {}, req.user.sub)),
  remove: handle(async (req) => {
    await service.deleteTemplate(req.params.key, req.user.sub);
    return { deleted: true };
  }),
  restore: handle((req) => service.restoreTemplate(req.params.key, req.user.sub)),
  send: handle((req) => service.sendTemplate(req.params.key, req.body ?? {}, req.user.sub)),
  view: handle((req) => service.viewOutbox(req.params.id)),
  sendTest: handle((req) =>
    service.sendTest(
      req.params.key,
      req.body?.to || req.user.email,
      { subject: req.body?.subject, html: req.body?.html },
      req.user.sub
    )
  ),
  outbox: handle((req) => service.listOutbox(req.query)),
  retry: handle((req) => service.retryOutbox(req.params.id)),
  getSettings: handle(async () => ({ ...(await service.getSettings()), ...deliveryInfo() })),
  saveSettings: handle(async (req) => ({ ...(await service.saveSettings(req.body ?? {})), ...deliveryInfo() })),
};
