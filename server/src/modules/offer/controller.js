const { ApiResponse } = require('../../core/ApiResponse');
const offerService = require('./service');

const handle = (fn, respond = ApiResponse.success) => async (req, res, next) => {
  try {
    respond(res, { data: await fn(req) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list: handle(() => offerService.listOffers()),
  create: handle((req) => offerService.createOffer(req.body, req.user.sub), ApiResponse.created),
  update: handle((req) => offerService.updateOffer(req.params.id, req.body, req.user.sub)),
  remove: handle(async (req) => {
    await offerService.deleteOffer(req.params.id, req.user.sub);
    return { deleted: true };
  }),
  setImage: handle((req) => offerService.setOfferImage(req.params.id, req.file, req.user.sub)),
  removeImage: handle((req) => offerService.removeOfferImage(req.params.id, req.user.sub)),
};
