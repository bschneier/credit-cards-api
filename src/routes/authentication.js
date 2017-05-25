const router = require('express').Router;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
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
  if(!req.body.hasOwnProperty('userName') || !req.body.hasOwnProperty('password')) {
    apiLogger.info(formatApiLogMessage('invalid authentication request: ' + JSON.stringify(req.body), req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_REQUEST).json({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_REQUEST });
  }
  else {
    User.findOne({ userName : req.body.userName }, '-email -lastName', (err, user) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Authentication request failed - error finding user '${req.body.userName}': ${err}`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
      }

      if (user) {
        // check if user account is locked
        if(user.lockoutExpiration > new Date()) {
          apiLogger.info(formatApiLogMessage(`Account for user ${user.userName} is locked out. Lockout expiration is ${user.lockoutExpiration}.`, req));
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
            apiLogger.info(formatApiLogMessage(`User '${user.userName}' has logged in successfully`, req));

            if(req.body.rememberMe) {
              let promise = new Promise(function(resolve, reject) {
                setNewRememberMeToken(user, req, res, resolve);
              });
              promise.then((result) => { sendLoginSuccessResponse(user, res, tokens.sessionToken); });
            }
            else {
              sendLoginSuccessResponse(user, res, tokens.sessionToken);
            }
          }
          else {
            apiLogger.info(formatApiLogMessage(`Incorrect password for user '${user.userName}'`, req));

            // increment login failures in cache and lock user account if necessary
            redisClient.get('login-failures:' + user._id, (error, failures) => {
              if(failures === '4') {
                let expiration = moment().add(1, 'd').toDate();
                user.lockoutExpiration = expiration;
                user.save((err) => {
                  if(err) {
                    apiLogger.error(formatApiLogMessage(`Error setting lockoutExpiration for user '${user.userName}': ${err}`, req));
                  }
                  else {
                    apiLogger.info(formatApiLogMessage(`Set lockoutExpiration for user ${user.userName} to ${expiration}`, req));
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
        apiLogger.info(formatApiLogMessage(`Login failed - could not find user '${req.body.userName}'`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_CREDENTIALS });
      }
    });
  }
}

function getNewSessionForRememberedUser(req, res) {
  const rememberMeToken = req.signedCookies[REMEMBER_ME_COOKIE_NAME];
  if (rememberMeToken) {
    User.findOne({ tokens : { $elemMatch : { _id : rememberMeToken, expiration : { $gt : new Date() } } } },'-email -lastName', (err, user) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Error finding user by rememberMe token '${rememberMeToken}': ${err}`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.ERROR).json({ message: CONSTANTS.RESPONSE_MESSAGES.INTERNAL_ERROR_MESSAGE });
      }

      if (user) {
        // check if user account is locked
        if(user.lockoutExpiration > new Date()) {
          apiLogger.info(formatApiLogMessage(`Account for user ${user.userName} is locked out. Lockout expiration is ${user.lockoutExpiration}.`, req));
          return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({
            message: CONSTANTS.RESPONSE_MESSAGES.LOGIN_FAILURE,
            errors: [ CONSTANTS.ERRORS.USER_LOCKED_OUT ]
          });
        }
        else {
          // generate new session for user
          let tokens = generateAuthTokens(user);
          req.session.token = tokens.cookieToken;
          apiLogger.info(formatApiLogMessage(`User '${user.userName}' has logged in successfully using rememberMe token ${rememberMeToken}`, req));

          // remove current rememberMe token and generate new one with updated expiration date
          let currentTokenIndex = null;
          user.tokens.some((value, index) => {
            if(value._id === rememberMeToken) {
              currentTokenIndex = index;
              return true;
            }
            return false;
          });
          user.tokens.splice(currentTokenIndex, 1);
          let promise = new Promise(function(resolve, reject) {
            setNewRememberMeToken(user, req, res, resolve);
          });
          promise.then((result) => { sendLoginSuccessResponse(user, res, tokens.sessionToken); });
        }
      }
      else {
        apiLogger.info(formatApiLogMessage(`Could not find user with rememberMe token '${rememberMeToken}'`, req));
        return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_CREDENTIALS });
      }
    });
  }
  else {
    apiLogger.info(formatApiLogMessage(`No rememberMe token provided.`, req));
    return res.status(CONSTANTS.HTTP_STATUS_CODES.INVALID_AUTHENTICATION).json({ message: CONSTANTS.RESPONSE_MESSAGES.INVALID_CREDENTIALS });
  }
}

function generateAuthTokens(user) {
  let sessionExpirationMinutes = config.get('session.expirationMinutes');
  const sessionToken = jwt.sign({ userName: user.userName, role: user.role, groupId: user.groupId }, process.env.TOKEN_SECRET, {
    expiresIn: sessionExpirationMinutes * 60
  });
  const cookieToken = jwt.sign({ userName: user.userName, role: user.role, groupId: user.groupId, cookie: true }, process.env.COOKIE_TOKEN_SECRET, {
    expiresIn: sessionExpirationMinutes * 60
  });
  return { sessionToken: sessionToken, cookieToken: cookieToken };
}

function setNewRememberMeToken(user, req, res, resolve) {
  let expiration = moment().add(config.get('rememberMe.expirationDays'), 'd').toDate();
  let newToken = { expiration: expiration };
  if(user.tokens) {
    user.tokens.push(newToken);
  }
  else {
    user.tokens = [ newToken ];
  }

  User.findByIdAndUpdate(user._id, { tokens: user.tokens }, { new: true }, (err, user) => {
    if (err) {
      apiLogger.error(formatApiLogMessage(`Failed to add rememberMe token for user '${user.userName}': ${err}`, req));
    }
    else {
      let newToken = user.tokens.find((token) => {
        return token.expiration.getTime() === expiration.getTime();
      });
      // TODO: set secure attribute on this cookie once SSL implemented
      res.cookie(REMEMBER_ME_COOKIE_NAME, newToken._id, { expires: expiration, httpOnly: true, signed: true, domain: config.get('cookieDomain') });
      apiLogger.info(formatApiLogMessage(`Set new rememberMe token for user '${user.userName}'.`, req));
    }

    resolve();
  });
}

function sendLoginSuccessResponse(user, res, token) {
  // We do not want to send password, tokens, lockout expiration date, or mongo document version back in response
  user.password = undefined;
  user.tokens = undefined;
  user.__v = undefined;
  user.lockoutExpiration = undefined;

  return res.status(CONSTANTS.HTTP_STATUS_CODES.OK).json({
    message: CONSTANTS.RESPONSE_MESSAGES.LOGIN_SUCCESS,
    user : user,
    token : token
  });
}

let routes = router();
routes.post('', authenticate);
routes.get('', getNewSessionForRememberedUser);

module.exports = { routes, setRedisClient };