# Admin Server

Node.js + Express backend for the [admin panel](../). Handles auth, hotels, rooms, pricing, bookings, and admin operations. Runs as its own independent server on port 4001 (see [`web/server`](../../web/server) for the guest-facing server on port 4000).

## Stack

- Express 5
- PostgreSQL (Knex.js for migrations & queries)
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- File uploads (`multer`)

## Setup

```bash
npm install
cp .env.example .env   # set DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/JWT_SECRET/PORT
npx knex migrate:latest  # run all migrations
npx knex seed:run         # seed test users and sample hotels
npm run dev                # starts with nodemon on http://localhost:4001
```

## Architecture

### Auth
- Guests sign up → creates row in `users` (role `guest`) + row in `customers` (for bookings)
- Token includes `customerId` so guests embed their own ID when booking
- Admins (role `admin`) can book on behalf of walk-in customers
- All protected endpoints check `Authorization: Bearer <jwt>`

### Hotel domain
- Hotels have images, amenities, policy notes, check-in/out times
- Rooms (room types) belong to hotels; have images, amenities, max occupancy
- Rate plans set price per night for each room type
- Room inventory tracks availability per date (total/booked/blocked)

### Booking flow
1. Guest selects hotel + room type + dates → calls `POST /api/bookings` with their JWT
2. Server checks room inventory for all nights (atomic row-lock transaction)
3. Computes pricing: room price × nights × rooms → add taxes/fees → apply coupon → total
4. Reserves inventory (increments booked count)
5. Returns booking object with `id`, `total_amount`, `booking_status: 'pending'`
6. Admin can transition status: pending → confirmed → checked_in → checked_out
7. If booking cancelled, inventory is released

### Pricing
- Tax rules (percentage or fixed) apply to room price
- Coupons can discount by amount or percentage
- All pricing computed server-side (never trust client)

## Endpoints

### Auth (no auth needed)
```
POST   /api/auth/register   { name, email, password } → { token, user }
POST   /api/auth/login      { email, password } → { token, user }
```

### Hotels (public read, admin write)
```
GET    /api/hotels                    # list active, filter by status/city/search
GET    /api/hotels/:id                # detail with images + amenities
POST   /api/hotels                    # admin: create
PUT    /api/hotels/:id                # admin: update
DELETE /api/hotels/:id                # admin: soft-delete (suspend)
POST   /api/hotels/:id/images         # admin: upload image
PUT    /api/hotels/:id/images/:imgId/primary
DELETE /api/hotels/:id/images/:imgId
PUT    /api/hotels/:id/amenities      # admin: set amenity associations
```

### Rooms (public read, admin write)
```
GET    /api/hotels/:hotelId/room-types
POST   /api/hotels/:hotelId/room-types
GET    /api/room-types/:id            # with rate plans + amenities
PUT    /api/room-types/:id
DELETE /api/room-types/:id            # soft-delete
POST   /api/room-types/:id/images
PUT    /api/room-types/:id/images/:imgId/primary
DELETE /api/room-types/:id/images/:imgId
PUT    /api/room-types/:id/amenities
GET    /api/room-types/:id/inventory?from=DATE&to=DATE  # availability grid
PUT    /api/room-types/:id/inventory  # admin: set total/per date
PUT    /api/room-types/:id/inventory/:date/block        # admin: block rooms
```

### Bookings (auth required)
```
GET    /api/bookings              # admin: list all, filter by status/hotel/date
GET    /api/bookings/mine         # guest: own bookings
GET    /api/bookings/:id          # guest owns it or admin
POST   /api/bookings              # guest: self-book, admin: book on behalf (requires customerId in body)
PUT    /api/bookings/:id/status   # admin: transition status
```

### Customers (admin only)
```
GET    /api/customers
GET    /api/customers/:id         # with booking history
POST   /api/customers
PUT    /api/customers/:id/status
```

### Coupons, Reviews, Payments, Reports, etc.
(Backend has full implementation; web app doesn't use yet)

## Project structure

```
src/
  server.js                  # app entrypoint, middleware, route wiring
  db.js                      # Knex instance
  authRoutes.js              # register, login
  authMiddleware.js          # requireAuth, requireRole, requirePermission
  hotelRoutes.js             # hotel CRUD + images + amenities
  roomRoutes.js              # room type CRUD + inventory
  ratePlanRoutes.js
  bookingRoutes.js           # booking creation + status transitions
  customerRoutes.js          # customer CRUD
  couponRoutes.js
  reviewRoutes.js
  paymentRoutes.js
  reportRoutes.js
  auditLogRoutes.js
  notificationRoutes.js
  settingsRoutes.js
  adminUserRoutes.js
  adminRoutes.js
  amenityRoutes.js
  errorHandler.js            # global error handler
  validate.js                # input validation helper
  uploads.js                 # multer config for image uploads
  services/
    availabilityService.js   # inventory reservation (atomic)
    pricingService.js        # price calculation
    couponService.js         # coupon validation
    auditService.js          # audit logging
migrations/
  20260101000001_create_users.js
  20260101000002_create_hotels.js
  ... (11 total migrations)
seeds/
  001_users.js               # test users (guest, admin)
  002_amenities.js           # amenity list
  003_roles_permissions.js   # admin roles/permissions
  004_settings_tax.js        # tax rules
```

### Seeded data
- Test users: `guest@example.com` (password123), `admin@example.com` (admin123)
- Sample hotels: Coorg Coffee Villa, The Grand Taj, etc.
- Room types + rate plans + inventory per property
- Amenities (wifi, pool, gym, etc.)
- Tax rules (GST 5%, 12%, 18%)
