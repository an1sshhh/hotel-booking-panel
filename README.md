# hotel-booking-panel — Stayfarer Admin

Angular admin panel and its Express API (`server/`) for the Stayfarer hotel booking platform. Admins use it to manage hotels, rooms, pricing and inventory, bookings (including cancellations with Razorpay refunds), offers, customers, admin users, email templates and reports (CSV/PDF). The guest website lives in [stayfarer](https://github.com/an1sshhh/stayfarer); both APIs share one PostgreSQL database.

## Run locally

```bash
# API — http://localhost:4001
cd server
npm install
cp .env.example .env        # fill in the values
npx knex migrate:latest
npm run dev

# Panel — http://localhost:4200
cd ..
npm install
npm start
```

Admin login is email + password followed by an emailed OTP. Self sign-up at `/signup` only works until an admin with a real email address exists; after that, admins are added from **Admin Users**.

## Deploy (free tier)

| Piece | Host | Config |
|---|---|---|
| Database | Supabase (session pooler, port 5432) | `DATABASE_URL`, `DATABASE_PASSWORD` |
| Images | Supabase Storage, public bucket `images` | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` |
| Email | Your Gmail via a Google Apps Script relay over HTTPS ([`server/scripts/gmail-relay.gs`](server/scripts/gmail-relay.gs)); Render's free plan blocks SMTP | `GMAIL_SCRIPT_URL`, `GMAIL_SCRIPT_SECRET`, `EMAIL_FROM` |
| API (`server/`) | Render — [`render.yaml`](render.yaml) | set the `sync: false` vars in the Render dashboard |
| Panel | Vercel — [`vercel.json`](vercel.json) | API URL in `src/environments/environment.prod.ts` |

1. **Render** → New → Blueprint → pick this repo. Fill in the secrets it asks for. `JWT_SECRET` must be the same value as on the guest API. Set `ADMIN_URL`/`CORS_ORIGINS` to the Vercel URL of the panel.
2. If Render names the service something other than `https://stayfarer-admin-api.onrender.com`, update `environment.prod.ts` and push.
3. **Vercel** → Add New Project → this repo. `vercel.json` sets the build; no environment variables are needed.
4. Run migrations against the hosted DB from your machine: `cd server && npx knex migrate:latest` (with the Supabase values in `.env`).

Render's free services sleep after 15 minutes idle, so the first request after that takes about a minute.
