require('dotenv').config();
const fs = require('fs');
const path = require('path');

/*
 * Database connection. Either:
 *   DATABASE_URL=postgresql://user@host:5432/db   (Supabase / Neon "connection string")
 *   DATABASE_PASSWORD=...                           (kept separate so it needs no URL-encoding)
 * or the separate DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME (local Postgres).
 *
 * Hosted Postgres only accepts encrypted connections: set DB_SSL=true. The server
 * certificate is verified; for a provider with its own certificate authority
 * (Supabase), download its CA certificate and set DB_SSL_CA_FILE to its path.
 * DB_SSL_REJECT_UNAUTHORIZED=false turns verification off — last resort only.
 */
function sslConfig() {
  if (process.env.DB_SSL !== 'true') return false;
  const ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
  if (process.env.DB_SSL_CA_FILE) ssl.ca = fs.readFileSync(path.resolve(__dirname, process.env.DB_SSL_CA_FILE), 'utf8');
  return ssl;
}

/**
 * Builds the final URL: SSL is configured above, so sslmode & co. are dropped (they'd
 * silently override it), and DATABASE_PASSWORD is inserted with proper encoding.
 */
function databaseUrl(raw) {
  const u = new URL(raw.trim());
  for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) u.searchParams.delete(key);
  if (process.env.DATABASE_PASSWORD) u.password = encodeURIComponent(process.env.DATABASE_PASSWORD);
  const pw = decodeURIComponent(u.password);
  if (!pw || /YOUR-PASSWORD/i.test(pw)) {
    throw new Error('DATABASE_URL has no password: set DATABASE_PASSWORD in .env to your database password.');
  }
  return u.toString();
}

const connection = process.env.DATABASE_URL
  ? { connectionString: databaseUrl(process.env.DATABASE_URL), ssl: sslConfig() }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hotel_booking',
      ssl: sslConfig(),
    };

module.exports = {
  client: 'pg',
  connection,
  pool: { min: 0, max: Number(process.env.DB_POOL_MAX) || 10 },
  migrations: { directory: './migrations' },
  seeds: { directory: './seeds' },
};
