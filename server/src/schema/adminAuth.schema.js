const { validate } = require('../shared/utils/validator');
const { ApiError } = require('../core/ApiError');

function adminSignupSchema(body) {
  return validate(body)
    .string('name', { required: true, max: 200, label: 'Name' })
    .email('email', { required: true, label: 'Email' })
    .password('password', { required: true, min: 8, label: 'Password' })
    .result();
}

function adminLoginSchema(body) {
  return validate(body)
    .email('email', { required: true, label: 'Email' })
    .string('password', { required: true, max: 255, label: 'Password' })
    .result();
}

function adminVerifyOtpSchema(body) {
  const result = validate(body)
    .email('email', { required: true, label: 'Email' })
    .string('otp', { required: true, max: 6, label: 'OTP' })
    .result();

  if (!/^\d{6}$/.test(result.otp)) {
    throw ApiError.badRequest('OTP must be a 6-digit code', [{ field: 'otp', message: 'OTP must be a 6-digit code' }]);
  }
  return result;
}

module.exports = { adminSignupSchema, adminLoginSchema, adminVerifyOtpSchema };
