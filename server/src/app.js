const path = require('path');
const express = require('express');
const cors = require('cors');
const { requestId } = require('./middleware/requestId.middleware');
const { ApiResponse, apiErrorHandler, notFoundHandler } = require('./core/ApiResponse');

const app = express();

app.use(requestId);
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Composition root: each feature module owns its own route -> controller -> service triplet.
app.use('/api/auth', require('./modules/auth/route'));
app.use('/api/hotels', require('./modules/hotel/route'));
app.use('/api', require('./modules/room/route')); // /hotels/:hotelId/room-types, /room-types/:id/...
app.use('/api', require('./modules/ratePlan/route')); // /room-types/:id/rate-plans, /rate-plans/:id
app.use('/api/amenities', require('./modules/amenity/route'));
app.use('/api/bookings', require('./modules/booking/route'));
app.use('/api/customers', require('./modules/customer/route'));
app.use('/api/coupons', require('./modules/coupon/route'));
app.use('/api/offers', require('./modules/offer/route'));
app.use('/api/email-templates', require('./modules/emailTemplate/route'));
app.use('/api/reviews', require('./modules/review/route'));
app.use('/api/payments', require('./modules/payment/route'));
app.use('/api/reports', require('./modules/report/route'));
app.use('/api/admin-users', require('./modules/adminUser/route'));
app.use('/api/audit-logs', require('./modules/auditLog/route'));
app.use('/api/notifications', require('./modules/notification/route'));
app.use('/api/settings', require('./modules/settings/route'));
app.use('/api/locations', require('./modules/location/route'));
app.use('/api/admin', require('./modules/dashboard/route'));

// Must stay last: unmatched API routes, then the global error handler.
app.use('/api', notFoundHandler);
app.use(apiErrorHandler);

module.exports = app;
