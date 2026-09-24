const db = require('../../database/db');

async function listAuditLogs({ entityType, page = 1, pageSize = 50 }) {
  let query = db('audit_logs')
    .leftJoin('users', 'users.id', 'audit_logs.admin_user_id')
    .select('audit_logs.*', 'users.name as admin_name');

  if (entityType) query = query.where('audit_logs.entity_type', entityType);

  return query
    .orderBy('audit_logs.created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);
}

module.exports = { listAuditLogs };
