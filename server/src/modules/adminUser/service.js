const bcrypt = require('bcryptjs');
const db = require('../../database/db');
const { ApiError } = require('../../core/ApiError');
const { adminUserCreateSchema } = require('../../schema/adminUser.schema');

async function listAdminUsers() {
  return db('users')
    .leftJoin('roles', 'roles.id', 'users.role_id')
    .select('users.id', 'users.name', 'users.email', 'users.role', 'users.status', 'roles.name as role_name');
}

async function createAdminUser(body) {
  const { name, email, password, roleId } = adminUserCreateSchema(body);

  const password_hash = await bcrypt.hash(password, 10);
  const [user] = await db('users')
    .insert({ name, email, password_hash, role: 'admin', role_id: roleId ?? null })
    .returning(['id', 'name', 'email', 'role', 'role_id']);

  return user;
}

async function updateAdminUser(id, { roleId, status }) {
  const [user] = await db('users')
    .where({ id })
    .update({
      ...(roleId !== undefined ? { role_id: roleId } : {}),
      ...(status !== undefined ? { status } : {}),
    })
    .returning(['id', 'name', 'email', 'role', 'role_id', 'status']);

  if (!user) throw ApiError.notFound('Admin user not found');
  return user;
}

async function listRoles() {
  const roles = await db('roles');
  if (!roles.length) return roles;

  const rows = await db('role_permissions')
    .join('permissions', 'permissions.id', 'role_permissions.permission_id')
    .whereIn('role_permissions.role_id', roles.map((r) => r.id))
    .select('role_permissions.role_id', 'permissions.key');

  const permissionsByRole = {};
  for (const row of rows) {
    (permissionsByRole[row.role_id] ??= []).push(row.key);
  }

  return roles.map((role) => ({ ...role, permissions: permissionsByRole[role.id] || [] }));
}

module.exports = { listAdminUsers, createAdminUser, updateAdminUser, listRoles };
