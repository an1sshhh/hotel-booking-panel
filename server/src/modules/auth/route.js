const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.get('/admin/signup-status', controller.adminSignupStatus);
router.post('/admin/signup', controller.adminSignup);
router.post('/admin/login', controller.adminLogin);
router.post('/admin/verify-otp', controller.adminVerifyOtp);

module.exports = router;
