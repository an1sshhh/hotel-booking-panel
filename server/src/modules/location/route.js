const express = require('express');
const { requireAuth } = require('../../middleware/auth.middleware');
const controller = require('./controller');

const router = express.Router();
router.use(requireAuth);

router.get('/countries', controller.listCountries);
router.get('/countries/:countryCode/states', controller.listStates);
router.get('/countries/:countryCode/states/:stateCode/cities', controller.listCities);
router.get('/pincode/:code', controller.lookupPincode);

module.exports = router;
