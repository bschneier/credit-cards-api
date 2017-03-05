let router = require('express').Router;
let logging = require('../logging');
let frontEndLogger = logging.frontEndLogger;
let formatFrontEndLogMessage = logging.formatFrontEndLogMessage;

function writeFrontEndLogMessage(req, res) {
  switch(req.body.logLevel) {
    case 'ERROR':
      frontEndLogger.error(formatFrontEndLogMessage(req));
      break;
    case 'WARN':
      frontEndLogger.warn(formatFrontEndLogMessage(req));
      break;
    default:
      frontEndLogger.info(formatFrontEndLogMessage(req));
      break;
  }
  res.json({info: 'log entry created successfully'});
}

let frontEndLogRoutes = router();
frontEndLogRoutes.post('', writeFrontEndLogMessage);

module.exports = frontEndLogRoutes;