const { ApiResponse } = require('../../core/ApiResponse');
const reportService = require('./service');

async function catalog(req, res, next) {
  try {
    ApiResponse.success(res, { data: reportService.getCatalog() });
  } catch (err) {
    next(err);
  }
}

async function run(req, res, next) {
  try {
    ApiResponse.success(res, { data: await reportService.runReport(req.params.key, req.query) });
  } catch (err) {
    next(err);
  }
}

async function exportFile(req, res, next) {
  try {
    const file = await reportService.exportReport(req.params.key, req.query, String(req.query.format || '').toLowerCase());
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    if (file.stream) file.stream.pipe(res);
    else res.send(file.body);
  } catch (err) {
    next(err);
  }
}

module.exports = { catalog, run, exportFile };
