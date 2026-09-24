const { ApiResponse } = require('../../core/ApiResponse');
const authService = require('./service');
const { adminSignupSchema, adminLoginSchema, adminVerifyOtpSchema } = require('../../schema/adminAuth.schema');

async function adminSignupStatus(req, res, next) {
  try {
    ApiResponse.success(res, { data: { open: await authService.isAdminSignupOpen() } });
  } catch (err) {
    next(err);
  }
}

async function adminSignup(req, res, next) {
  try {
    const body = adminSignupSchema(req.body);
    const user = await authService.adminSignup(body);
    ApiResponse.created(res, { message: 'Account created', data: user });
  } catch (err) {
    next(err);
  }
}

async function adminLogin(req, res, next) {
  try {
    const body = adminLoginSchema(req.body);
    const result = await authService.adminLogin(body);
    ApiResponse.success(res, { message: 'OTP sent to your email', data: result });
  } catch (err) {
    next(err);
  }
}

async function adminVerifyOtp(req, res, next) {
  try {
    const body = adminVerifyOtpSchema(req.body);
    const result = await authService.adminVerifyOtp(body);
    ApiResponse.success(res, { message: 'Logged in', data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { adminSignupStatus, adminSignup, adminLogin, adminVerifyOtp };
