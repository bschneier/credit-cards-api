const jwt = require('jsonwebtoken');
const logging = require('../logging');
const CONSTANTS = require('../constants');

const apiLogger = logging.apiLogger;
const formatApiLogMessage = logging.formatApiLogMessage;

function authenticationGuard(req, res, next) {
  try {
    let cookieToken = jwt.verify(req.session.token, process.env.COOKIE_TOKEN_SECRET);
    apiLogger.info('Successfully parsed cookie token');
    let headerToken = jwt.verify(req.headers['credit-cards-authentication'], process.env.TOKEN_SECRET);

    if(headerToken.userName === cookieToken.userName && headerToken.role === cookieToken.role
      && headerToken.groupId === cookieToken.groupId) {
      req.role = headerToken.role;
      req.groupId = headerToken.groupId;
      req.userName = headerToken.userName;
      next();
    }
    else {
      apiLogger.info(formatApiLogMessage(`Invalid tokens - content does not match. HeaderToken: ${headerToken}, CookieToken: ${cookieToken}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).send({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_AUTHENTICATION });
    }
  }
  catch (err) {
    apiLogger.info(formatApiLogMessage(`Invalid token - error parsing cookie or header token: ${err}`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).send({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_AUTHENTICATION });
  }
}

function adminGuard(req, res, next) {
  if(req.role !== 'admin') {
    apiLogger.info(formatApiLogMessage(`Unauthorized request`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.NOT_AUTHORIZED).send({ message: CONSTANTS.RESPONSE_MESSAGES.NOT_AUTHORIZED });
  }
  else {
    next();
  }
}

module.exports = { authenticationGuard, adminGuard };