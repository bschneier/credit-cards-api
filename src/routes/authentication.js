const router = require('express').Router;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const User = require('../models/users');
const logging = require('../logging');
const CONSTANTS = require('../constants');

const apiLogger = logging.apiLogger;
const formatApiLogMessage = logging.formatApiLogMessage;
const REMEMBER_ME_COOKIE_NAME = config.get('rememberMe.cookieName');
let redisClient;

function setRedisClient(client) {
  redisClient = client;
}

function authenticate(req, res) {
  // validate request for expected parameters
  if(!req.body.hasOwnProperty('username') || !req.body.hasOwnProperty('password')) {
    apiLogger.info(formatApiLogMessage('invalid authentication request: ' + JSON.stringify(req.body), req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_REQUEST).json({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_REQUEST });
  }
  else {
    User.findOne({ username : req.body.username }, '-email -lastName', (err, user) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Authentication request failed - error finding user '${req.body.username}': ${err}`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
      }

      if (user) {
        // check if user account is locked
        if(user.lockoutExpiration > new Date()) {
          apiLogger.info(formatApiLogMessage(`Account for user ${user.username} is locked out. Lockout expiration is ${user.lockoutExpiration}.`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({
            message: CONSTANTS.RESPONSE_MESSAGES.LOGIN_FAILURE,
            errors: [ CONSTANTS.ERRORS.USER_LOCKED_OUT ]
          });
        }
        else {
          // validate password
          if(bcrypt.compareSync(req.body.password, user.password)) {
            let tokens = generateAuthTokens(user);
            req.session.token = tokens.cookieToken;
            apiLogger.info(formatApiLogMessage(`User '${user.username}' has logged in successfully`, req));

            if(req.body.rememberMe) {
              let promise = new Promise(function(resolve, reject) {
                setNewRememberMeToken(user, req, res, resolve);
              });
              promise.then((result) => { processLoginSuccess(user, res, tokens.sessionToken); });
            }
            else {
              processLoginSuccess(user, res, tokens.sessionToken);
            }
          }
          else {
            apiLogger.info(formatApiLogMessage(`Incorrect password for user '${user.username}'`, req));

            // increment login failures in cache and lock user account if necessary
            redisClient.get('login-failures:' + user._id, (error, failures) => {
              if(failures === '4') {
                let expiration = new Date(new Date().getTime() + (24*60*60*1000));
                user.lockoutExpiration = expiration;
                user.save((err) => {
                  if(err) {
                    apiLogger.error(formatApiLogMessage(`Error setting lockoutExpiration for user '${user.username}': ${err}`, req));
                  }
                  else {
                    apiLogger.info(formatApiLogMessage(`Set lockoutExpiration for user ${user.username} to ${expiration}`, req));
                  }
                });

                return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({
                  message: CONSTANTS.RESPONSE_MESSAGES.INVALID_CREDENTIALS,
                  errors: [CONSTANTS.ERRORS.USER_LOCKED_OUT]
                });
              }
              else {
                redisClient.setex('login-failures:' + user._id, 1200, ++failures);
                return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_CREDENTIALS });
              }
            });
          }
        }
      }
      else {
        apiLogger.info(formatApiLogMessage(`Login failed - could not find user '${req.body.username}'`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_CREDENTIALS });
      }
    });
  }
}

function getNewSessionForRememberedUser(token, req, res, next) {
  User.findOne({ tokens : { $elemMatch : { _id : token, expiration : { $gt : new Date() } } } },'-email -lastName', (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Error finding user by rememberMe token '${token}': ${err}`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
    }

    if (user) {
      // check if user account is locked
      if(user.lockoutExpiration > new Date()) {
        apiLogger.info(formatApiLogMessage(`Account for user ${user.username} is locked out. Lockout expiration is ${user.lockoutExpiration}.`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({
          message: CONSTANTS.RESPONSE_MESSAGES.LOGIN_FAILURE,
          errors: [ CONSTANTS.ERRORS.USER_LOCKED_OUT ]
        });
      }
      else {
        // generate new session for user
        let tokens = generateAuthTokens(user);
        req.session.token = tokens.cookieToken;

        // set local variables on response object used by downstream routes
        // since these were not set previously by the authentication guard
        res.locals.role = user.role;
        res.locals.groupId = user.groupId;
        res.locals.username = user.username;

        apiLogger.info(formatApiLogMessage(`User '${user.username}' has logged in successfully using rememberMe token ${token}`, req));

        // remove current rememberMe token and generate new one with updated expiration date
        let currentTokenIndex = null;
        user.tokens.some((value, index) => {
          if(value._id === token) {
            currentTokenIndex = index;
            return true;
          }
          return false;
        });
        user.tokens.splice(currentTokenIndex, 1);
        let promise = new Promise(function(resolve, reject) {
          setNewRememberMeToken(user, req, res, resolve);
        });
        promise.then((result) => { processLoginSuccess(user, res, tokens.sessionToken, next); });
      }
    }
    else {
      apiLogger.info(formatApiLogMessage(`Could not find user with rememberMe token '${token}'`, req));
      return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_CREDENTIALS });
    }
  });
}

function generateAuthTokens(user) {
  // keep jwt header tokens valid for 24 hours and rely on express session to expire cookie token with rolling window
  const sessionToken = jwt.sign({ username: user.username, role: user.role, groupId: user.groupId }, process.env.TOKEN_SECRET, {
    expiresIn: 60 * 60 * 24
  });
  const cookieToken = { username: user.username, role: user.role, groupId: user.groupId };
  return { sessionToken: sessionToken, cookieToken: cookieToken };
}

function setNewRememberMeToken(user, req, res, resolve) {
  let expiration = new Date(new Date().getTime() + (config.get('rememberMe.expirationDays')*24*60*60*1000));
  let newToken = { expiration: expiration };
  if(user.tokens) {
    user.tokens.push(newToken);
  }
  else {
    user.tokens = [ newToken ];
  }

  User.findByIdAndUpdate(user._id, { tokens: user.tokens }, { new: true }, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Failed to add rememberMe token for user '${user.username}': ${err}`, req));
    }
    else {
      let newToken = user.tokens.find((token) => {
        return token.expiration.getTime() === expiration.getTime();
      });
      // TODO: set secure attribute on this cookie once SSL implemented
      res.cookie(REMEMBER_ME_COOKIE_NAME, newToken._id, { expires: expiration, httpOnly: true, signed: true, domain: config.get('cookieDomain') });
      apiLogger.info(formatApiLogMessage(`Set new rememberMe token for user '${user.username}'.`, req));
    }

    resolve();
  });
}

function processLoginSuccess(user, res, token, nextAction) {
  // We do not want to send password, tokens, lockout expiration date, or mongo document version back in response
  user.password = undefined;
  user.tokens = undefined;
  user.__v = undefined;
  user.lockoutExpiration = undefined;

  res.locals.user = user;
  res.locals.token = token;

  if(nextAction) {
    nextAction();
  }
  else {
    return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
      message: CONSTANTS.RESPONSE_MESSAGES.LOGIN_SUCCESS
    });
  }
}

function logout(req, res){
  const rememberMeToken = req.signedCookies[REMEMBER_ME_COOKIE_NAME];
  if(rememberMeToken) {
    User.findOne({ username : res.locals.username },'username tokens', (err, user) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Error finding user '${res.locals.username}': ${err}`, req));
      }
      else if (user) {
        const tokenIndex = user.tokens.indexOf(rememberMeToken);
        if(tokenIndex !== -1) {
          user.tokens.splice(tokenIndex, 1);
          User.findByIdAndUpdate(user._id, { tokens: user.tokens }, (err, user) => {
            if (err) {
              apiLogger.error(formatApiLogMessage(`Failed to remove rememberMe token for user '${user.username}': ${err}`, req));
            }
          });
        }
        else {
          apiLogger.error(formatApiLogMessage(`Could not find rememberMe token for user '${user.username}' when logging out`, req));
        }
      }
    });
  }

  return sendLogoutResponse(req, res, CONSTANTS.HTTP_STATUS_CODES.OK, { message: CONSTANTS.RESPONSE_MESSAGES.LOGOUT_SUCCESS });
}

function sendLogoutResponse(req, res, responseCode, messageBody) {
  req.session.destroy(function(err) {
    if(err) {
      apiLogger.error(formatApiLogMessage(`Error removing user session on logout: ${err}`, req));
    }
  });

  if(req.signedCookies[REMEMBER_ME_COOKIE_NAME]) {
    res.cookie(REMEMBER_ME_COOKIE_NAME, null, { expires: new Date(), httpOnly: true, signed: true, domain: config.get('cookieDomain') });
  }

  apiLogger.info(formatApiLogMessage(`User ${res.locals.username} has logged out successfully.`, req));
  return res.status(responseCode).json(messageBody);
}

let authenticateRoute = router();
authenticateRoute.post('', authenticate);

let logoutRoute = router();
logoutRoute.post('', logout);

module.exports = { authenticateRoute, logoutRoute, setRedisClient, sendLogoutResponse,
  generateAuthTokens, getNewSessionForRememberedUser };