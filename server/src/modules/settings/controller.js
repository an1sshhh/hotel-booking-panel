const { ApiResponse } = require('../../core/ApiResponse');
const settingsService = require('./service');

async function getAll(req, res, next) {
  try {
    ApiResponse.success(res, { data: await settingsService.getSettings() });
  } catch (err) {
    next(err);
  }
}

async function upsert(req, res, next) {
  try {
    ApiResponse.success(res, { data: await settingsService.upsertSetting(req.params.key, req.body) });
  } catch (err) {
    next(err);
  }
}

async function listTaxRules(req, res, next) {
  try {
    ApiResponse.success(res, { data: await settingsService.listTaxRules() });
  } catch (err) {
    next(err);
  }
}

async function createTaxRule(req, res, next) {
  try {
    const rule = await settingsService.createTaxRule(req.body);
    ApiResponse.created(res, { data: rule });
  } catch (err) {
    next(err);
  }
}

async function updateTaxRule(req, res, next) {
  try {
    ApiResponse.success(res, { data: await settingsService.updateTaxRule(req.params.id, req.body) });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, upsert, listTaxRules, createTaxRule, updateTaxRule };
