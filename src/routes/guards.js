const jwt = require('jsonwebtoken');
const logging = require('../logging');
const CONSTANTS = require('../constants');
const config = require('config');
const authentication = require('./authentication');

const apiLogger = logging.apiLogger;
const formatApiLogMessage = logging.formatApiLogMessage;
const REMEMBER_ME_COOKIE_NAME = config.get('rememberMe.cookieName');

function authenticationGuard(req, res, next) {
  const rememberMeToken = req.signedCookies[REMEMBER_ME_COOKIE_NAME];
  let headerToken;
  try {
    headerToken = jwt.verify(req.headers[config.get('authenticationHeader')], process.env.TOKEN_SECRET);
  }
  catch (err) {
    apiLogger.info(formatApiLogMessage(`Invalid authentication token - error parsing header token: ${err}`, req));
    if(rememberMeToken) {
      authentication.getNewSessionForRememberedUser(rememberMeToken, req, res, next);
      return;
    }
    else {
      return authentication.sendLogoutResponse(req, res, CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION,
        { message: CONSTANTS.RESPONSE_MESSAGES.INVALID_AUTHENTICATION });
    }
  }

  if(req.session.token && headerToken.username === req.session.token.username
    && headerToken.role === req.session.token.role && headerToken.groupId === req.session.token.groupId) {
      res.locals.role = headerToken.role;
      res.locals.groupId = headerToken.groupId;
      res.locals.username = headerToken.username;

      next();
  }
  else {
    apiLogger.info(formatApiLogMessage(`Invalid authentication tokens - content does not match. HeaderToken: ${headerToken}, CookieToken: ${req.session.token}`, req));
    if(rememberMeToken) {
      authentication.getNewSessionForRememberedUser(rememberMeToken, req, res, next);
      return;
    }
    else {
      return authentication.sendLogoutResponse(req, res, CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION,
        { message: CONSTANTS.RESPONSE_MESSAGES.INVALID_AUTHENTICATION });
    }
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

function sessionInjector(body, req, res) {
  if(res.locals.token) {
    body.sessionToken = res.locals.token;
    body.sessionUser = res.locals.user;
  }

  return body;
}

module.exports = { authenticationGuard, adminGuard, sessionInjector };