/**
 * Small validation-schema builder. Endpoint schemas in src/schema/ compose
 * these calls; the API must never rely on client-side validation alone.
 */
const { ApiError } = require('../../core/ApiError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^\+?[0-9()\-\s]{6,20}$/;
const PINCODE_RE = /^[0-9]{6}$/;
// Protocol is optional — clients normalise to https:// before this ever runs,
// but we accept bare domains here too since the API must not rely on that.
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i;

/** Collects field errors so the client gets one useful response, not a cascade. */
class Validator {
  constructor(body) {
    this.body = body ?? {};
    this.errors = [];
    this.output = {};
  }

  /** Only touches fields present in the body, so PUT stays a partial update. */
  has(field) {
    return this.body[field] !== undefined;
  }

  string(field, { required = false, max = 255, label = field } = {}) {
    if (!this.has(field)) {
      if (required) this.errors.push({ field, message: `${label} is required` });
      return this;
    }

    const raw = this.body[field];
    if (raw === null || raw === '') {
      if (required) this.errors.push({ field, message: `${label} is required` });
      else this.output[field] = null;
      return this;
    }

    if (typeof raw !== 'string') {
      this.errors.push({ field, message: `${label} must be text` });
      return this;
    }

    const value = raw.trim();
    if (required && !value) {
      this.errors.push({ field, message: `${label} is required` });
      return this;
    }
    if (value.length > max) {
      this.errors.push({ field, message: `${label} must be ${max} characters or fewer` });
      return this;
    }

    this.output[field] = value || null;
    return this;
  }

  phone(field, { label = field } = {}) {
    if (!this.has(field)) return this;
    const raw = this.body[field];
    if (raw === null || raw === '') {
      this.output[field] = null;
      return this;
    }
    const value = String(raw).trim();
    if (!PHONE_RE.test(value)) {
      this.errors.push({ field, message: `${label} must contain only digits, spaces, +, - and ()` });
      return this;
    }
    this.output[field] = value;
    return this;
  }

  email(field, { required = false, label = field } = {}) {
    if (!this.has(field)) {
      if (required) this.errors.push({ field, message: `${label} is required` });
      return this;
    }
    const raw = this.body[field];
    if (raw === null || raw === '') {
      if (required) this.errors.push({ field, message: `${label} is required` });
      else this.output[field] = null;
      return this;
    }
    const value = String(raw).trim();
    if (!EMAIL_RE.test(value)) {
      this.errors.push({ field, message: `${label} must be a valid email address` });
      return this;
    }
    this.output[field] = value;
    return this;
  }

  password(field, { required = false, min = 8, label = field } = {}) {
    if (!this.has(field)) {
      if (required) this.errors.push({ field, message: `${label} is required` });
      return this;
    }
    const raw = this.body[field];
    if (raw === null || raw === '') {
      if (required) this.errors.push({ field, message: `${label} is required` });
      return this;
    }
    if (typeof raw !== 'string') {
      this.errors.push({ field, message: `${label} must be text` });
      return this;
    }
    if (raw.length < min) {
      this.errors.push({ field, message: `${label} must be at least ${min} characters` });
      return this;
    }
    this.output[field] = raw;
    return this;
  }

  pincode(field, { label = field } = {}) {
    if (!this.has(field)) return this;
    const raw = this.body[field];
    if (raw === null || raw === '') {
      this.output[field] = null;
      return this;
    }
    const value = String(raw).trim();
    if (!PINCODE_RE.test(value)) {
      this.errors.push({ field, message: `${label} must be 6 digits` });
      return this;
    }
    this.output[field] = value;
    return this;
  }

  url(field, { label = field, max = 255 } = {}) {
    if (!this.has(field)) return this;
    const raw = this.body[field];
    if (raw === null || raw === '') {
      this.output[field] = null;
      return this;
    }
    if (typeof raw !== 'string') {
      this.errors.push({ field, message: `${label} must be text` });
      return this;
    }
    const value = raw.trim();
    if (value.length > max) {
      this.errors.push({ field, message: `${label} must be ${max} characters or fewer` });
      return this;
    }
    if (!URL_RE.test(value)) {
      this.errors.push({ field, message: `${label} must be a valid website address` });
      return this;
    }
    this.output[field] = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return this;
  }

  number(field, { min, max, integer = false, label = field } = {}) {
    if (!this.has(field)) return this;
    const raw = this.body[field];
    if (raw === null || raw === '') {
      this.output[field] = null;
      return this;
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      this.errors.push({ field, message: `${label} must be a number` });
      return this;
    }
    if (integer && !Number.isInteger(value)) {
      this.errors.push({ field, message: `${label} must be a whole number` });
      return this;
    }
    if (min !== undefined && value < min) {
      this.errors.push({ field, message: `${label} must be ${min} or more` });
      return this;
    }
    if (max !== undefined && value > max) {
      this.errors.push({ field, message: `${label} must be ${max} or less` });
      return this;
    }

    this.output[field] = value;
    return this;
  }

  enum(field, allowed, { label = field } = {}) {
    if (!this.has(field)) return this;
    const raw = this.body[field];
    if (raw === null || raw === '') return this;

    const value = String(raw).trim();
    if (!allowed.includes(value)) {
      this.errors.push({ field, message: `${label} must be one of: ${allowed.join(', ')}` });
      return this;
    }
    this.output[field] = value;
    return this;
  }

  boolean(field) {
    if (!this.has(field)) return this;
    const raw = this.body[field];
    this.output[field] = raw === true || raw === 'true' || raw === 1 || raw === '1';
    return this;
  }

  time(field, { label = field } = {}) {
    if (!this.has(field)) return this;
    const raw = this.body[field];
    if (raw === null || raw === '') {
      this.output[field] = null;
      return this;
    }
    const value = String(raw).trim().slice(0, 5);
    if (!TIME_RE.test(value)) {
      this.errors.push({ field, message: `${label} must be a valid time (HH:MM)` });
      return this;
    }
    this.output[field] = value;
    return this;
  }

  date(field, { required = false, label = field } = {}) {
    if (!this.has(field)) {
      if (required) this.errors.push({ field, message: `${label} is required` });
      return this;
    }
    const raw = this.body[field];
    if (!raw) {
      if (required) this.errors.push({ field, message: `${label} is required` });
      return this;
    }
    if (Number.isNaN(new Date(raw).getTime())) {
      this.errors.push({ field, message: `${label} must be a valid date` });
      return this;
    }
    this.output[field] = raw;
    return this;
  }

  /** Throws a 400 carrying every field error, or returns the cleaned payload. */
  result() {
    if (this.errors.length) {
      throw ApiError.badRequest(this.errors[0].message, this.errors);
    }
    return this.output;
  }
}

function validate(body) {
  return new Validator(body);
}

module.exports = { validate };
