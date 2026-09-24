require('dotenv').config();
const knexConfig = require('../knexfile');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET,
  knex: knexConfig,
  mail: {
    // Gmail SMTP (local dev). Hosts that block SMTP (e.g. Render free) use Brevo's HTTPS API instead.
    user: process.env.EMAIL_USER,
    appPassword: process.env.EMAIL_APP_PASSWORD,
    brevoApiKey: process.env.BREVO_API_KEY,
    // The sender address: must be a verified sender in Brevo. Defaults to EMAIL_USER.
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
  },
  // Links and contact details used inside emails.
  email: {
    siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
    adminUrl: (process.env.ADMIN_URL || 'http://localhost:4200').replace(/\/$/, ''),
    supportEmail: process.env.SUPPORT_EMAIL || 'support@stayfarer.in',
  },
  // Image storage: Supabase Storage when both are set, else the local uploads/ folder.
  storage: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.SUPABASE_BUCKET || 'images',
  },
  // Same Razorpay account as web/server; admin only needs it to issue refunds.
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
};

// Fail at boot rather than run production on placeholder secrets or localhost email links.
if (config.env === 'production') {
  const problems = [];
  const secret = config.jwtSecret;
  if (!secret || secret.length < 32 || /change[_-]?this/i.test(secret)) {
    problems.push('JWT_SECRET must be set to a random string of at least 32 characters');
  }
  for (const key of ['SITE_URL', 'ADMIN_URL', 'SUPPORT_EMAIL']) {
    if (!process.env[key]) problems.push(`${key} must be set`);
  }
  if (problems.length) {
    throw new Error(`Invalid production configuration:\n - ${problems.join('\n - ')}`);
  }
}

module.exports = config;
