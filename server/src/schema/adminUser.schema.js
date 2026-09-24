const { validate } = require('../shared/utils/validator');

function adminUserCreateSchema(body) {
  return validate(body)
    .string('name', { required: true, max: 200, label: 'Name' })
    .email('email', { required: true, label: 'Email' })
    .password('password', { required: true, min: 8, label: 'Password' })
    .number('roleId', { integer: true, label: 'Role' })
    .result();
}

module.exports = { adminUserCreateSchema };
