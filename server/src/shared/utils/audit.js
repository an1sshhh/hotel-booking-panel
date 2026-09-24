const db = require('../../database/db');

async function logAction({ adminUserId, action, entityType, entityId, before, after }) {
  await db('audit_logs').insert({
    admin_user_id: adminUserId ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId != null ? String(entityId) : null,
    before_value: before ? JSON.stringify(before) : null,
    after_value: after ? JSON.stringify(after) : null,
  });
}

module.exports = { logAction };
