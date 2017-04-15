const router = require('express').Router;
const logging = require('../logging');
const CONSTANTS = require('../constants');

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

  return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({ message: CONSTANTS.RESPONSE_MESSAGES.SUCCESS });
}

let frontEndLogRoutes = router();
frontEndLogRoutes.post('', writeFrontEndLogMessage);

module.exports = frontEndLogRoutes;