const { validate } = require('../shared/utils/validator');

function customerCreateSchema(body) {
  return validate(body)
    .string('name', { required: true, max: 200, label: 'Name' })
    .email('email', { label: 'Email' })
    .phone('phone', { label: 'Phone' })
    .result();
}

module.exports = { customerCreateSchema };
