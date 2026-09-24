require('dotenv').config();

module.exports = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hotel_booking',
  },
  pool: { min: 0, max: 10 },
  migrations: { directory: './migrations' },
  seeds: { directory: './seeds' },
};
