const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../database/db');
const config = require('../../config');
const { findByEmail } = require('../../shared/utils/user');
const { ApiError } = require('../../core/ApiError');
const { sendOtpEmail } = require('../../shared/utils/mailer');
const { isReservedAddress } = require('../../shared/email/service');

/**
 * Guests log in against `users`, but bookings hang off `customers`.
 * Every guest gets a matching customer row (found-or-created here) so
 * the booking flow always has somewhere to attach.
 */
async function findOrCreateCustomer({ name, email }) {
  const existing = await db('customers').whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first();
  if (existing) return existing;
  const [customer] = await db('customers').insert({ name, email }).returning('*');
  return customer;
}

function issueToken(user, customerId) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      roleId: user.role_id ?? null,
      name: user.name,
      customerId: customerId ?? null,
    },
    config.jwtSecret,
    { expiresIn: '8h' }
  );
}

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, roleId: user.role_id ?? null };
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Self-signup only bootstraps the first admin; after that, admins are added from Admin Users.
 * Seeded placeholder admins (example.com etc.) don't count — they can't receive a login OTP.
 */
async function isAdminSignupOpen() {
  const admins = await db('users').where({ role: 'admin' }).pluck('email');
  return !admins.some((email) => !isReservedAddress(email));
}

async function adminSignup({ name, email, password }) {
  if (!(await isAdminSignupOpen())) {
    throw ApiError.forbidden('Sign-up is closed. Ask an existing admin to add you from Admin Users.');
  }
  const existing = await findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const [user] = await db('users').insert({ name, email, password_hash, role: 'admin' }).returning('*');
  return toPublicUser(user);
}

async function adminLogin({ email, password }) {
  const user = await findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const otp = generateOtp();
  const code_hash = await bcrypt.hash(otp, 10);
  await db('login_otps').where({ user_id: user.id, consumed_at: null }).del();
  await db('login_otps').insert({
    user_id: user.id,
    code_hash,
    expires_at: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendOtpEmail(user.email, otp, { name: user.name, expiresMinutes: Math.round(OTP_TTL_MS / 60000) });
  return { email: user.email };
}

async function adminVerifyOtp({ email, otp }) {
  const user = await findByEmail(email);
  if (!user) throw ApiError.unauthorized('Invalid or expired code');

  const record = await db('login_otps')
    .where({ user_id: user.id, consumed_at: null })
    .orderBy('created_at', 'desc')
    .first();

  if (!record || new Date(record.expires_at) < new Date()) {
    throw ApiError.unauthorized('Invalid or expired code');
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.unauthorized('Too many attempts. Request a new code.');
  }

  const matches = await bcrypt.compare(otp, record.code_hash);
  if (!matches) {
    await db('login_otps').where({ id: record.id }).increment('attempts', 1);
    throw ApiError.unauthorized('Invalid or expired code');
  }

  await db('login_otps').where({ id: record.id }).update({ consumed_at: new Date() });

  const customer = user.role === 'guest' ? await findOrCreateCustomer(user) : null;
  return { token: issueToken(user, customer?.id), user: toPublicUser(user) };
}

module.exports = { isAdminSignupOpen, adminSignup, adminLogin, adminVerifyOtp };
