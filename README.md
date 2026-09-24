# Admin Panel

Angular app for hotel/property admins: adding properties, uploading images, managing listings. Part of the [hotel-booking](../README.md) platform.

## Setup

```bash
npm install
npm start   # http://localhost:4200
```

Requires the [`server`](./server) app running on `http://localhost:4001` (see `src/environments/environment.ts` to change the API URL).

```bash
cd server
npm install
cp .env.example .env
npx knex migrate:latest
npx knex seed:run
npm run dev   # http://localhost:4001
```

## What's implemented

- `/login` — signs in against `POST /api/auth/login`, stores the JWT and user in `localStorage`.
- `/dashboard` — placeholder landing page, protected by `authGuard` (redirects to `/login` if not authenticated).

## Structure

```
src/app/
  auth/
    auth.service.ts    # login/logout, token storage
    auth.guard.ts       # route guard for protected pages
    login.component.*   # login form
  dashboard/
    dashboard.component.ts   # placeholder post-login page
```

## Next steps

- Property CRUD screens (create/edit/list properties).
- Image upload for property listings.
- Attach the stored JWT to outgoing requests (HTTP interceptor) once more admin endpoints exist.
# hotel-booking-panel
