const jwt = require('jsonwebtoken');
const logging = require('../logging');
const CONSTANTS = require('../constants');
const config = require('config');
const authentication = require('./authentication');

const apiLogger = logging.apiLogger;
const formatApiLogMessage = logging.formatApiLogMessage;

function authenticationGuard(req, res, next) {
  let headerToken;
  try {
    headerToken = jwt.verify(req.headers[config.get('authenticationHeader')], process.env.TOKEN_SECRET);
  }
  catch (err) {
    apiLogger.info(formatApiLogMessage(`Invalid authentication token - error parsing header token: ${err}`, req));
    return authentication.sendLogoutResponse(req, res, CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION,
      { message: CONSTANTS.RESPONSE_MESSAGES.INVALID_AUTHENTICATION });
  }

  if(req.session.token && headerToken.userName === req.session.token.userName
    && headerToken.role === req.session.token.role && headerToken.groupId === req.session.token.groupId) {
      res.locals.role = headerToken.role;
      res.locals.groupId = headerToken.groupId;
      res.locals.userName = headerToken.userName;

      next();
  }
  else {
    apiLogger.info(formatApiLogMessage(`Invalid authentication tokens - content does not match. HeaderToken: ${headerToken}, CookieToken: ${req.session.token}`, req));
    return authentication.sendLogoutResponse(req, res, CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION,
      { message: CONSTANTS.RESPONSE_MESSAGES.INVALID_AUTHENTICATION });
  }
}

function adminGuard(req, res, next) {
  if(res.locals.role !== 'admin') {
    apiLogger.info(formatApiLogMessage(`Unauthorized request`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.NOT_AUTHORIZED).send({ message: CONSTANTS.RESPONSE_MESSAGES.NOT_AUTHORIZED });
  }
  else {
    next();
  }
}

module.exports = { authenticationGuard, adminGuard };