const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');

async function listNotifications(unreadOnly) {
  let query = db('notifications').select();
  if (unreadOnly === 'true') query = query.where({ is_read: false });
  return query.orderBy('created_at', 'desc').limit(100);
}

async function markAsRead(id) {
  const [notification] = await db('notifications').where({ id }).update({ is_read: true }).returning('*');
  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
}

async function markAllAsRead() {
  await db('notifications').where({ is_read: false }).update({ is_read: true });
}

module.exports = { listNotifications, markAsRead, markAllAsRead };
