const { Country, State, City } = require('country-state-city');
const { ApiError } = require('../../core/ApiError');

function listCountries(req, res) {
  const countries = Country.getAllCountries().map((c) => ({ isoCode: c.isoCode, name: c.name }));
  res.json({ success: true, statusCode: 200, message: 'OK', data: countries });
}

function listStates(req, res) {
  const states = State.getStatesOfCountry(req.params.countryCode).map((s) => ({ isoCode: s.isoCode, name: s.name }));
  res.json({ success: true, statusCode: 200, message: 'OK', data: states });
}

function listCities(req, res) {
  const cities = City.getCitiesOfState(req.params.countryCode, req.params.stateCode).map((c) => ({ name: c.name }));
  res.json({ success: true, statusCode: 200, message: 'OK', data: cities });
}

/** India-only: proxies the free India Post pincode API (avoids CORS + keeps the third-party call server-side). */
async function lookupPincode(req, res, next) {
  try {
    const code = String(req.params.code).trim();
    if (!/^[0-9]{6}$/.test(code)) throw ApiError.badRequest('Pincode must be 6 digits');

    const response = await fetch(`https://api.postalpincode.in/pincode/${code}`);
    if (!response.ok) throw ApiError.badRequest('Pincode lookup failed');

    const [result] = await response.json();
    const postOffice = result?.PostOffice?.[0];
    if (result?.Status !== 'Success' || !postOffice) {
      throw ApiError.notFound('No location found for this pincode');
    }

    // District usually matches a known city name (e.g. "Udaipur"); Block/Name are
    // finer-grained localities that rarely do — send both so the client can try each.
    res.json({
      success: true,
      statusCode: 200,
      message: 'OK',
      data: {
        state: postOffice.State,
        cityCandidates: [postOffice.District, postOffice.Block, postOffice.Name].filter(Boolean),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCountries, listStates, listCities, lookupPincode };
