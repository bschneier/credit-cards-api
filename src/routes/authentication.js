const router = require('express').Router;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('config');
const User = require('../models/users');
const logging = require('../logging');

const apiLogger = logging.apiLogger;
const formatApiLogMessage = logging.formatApiLogMessage;
const REMEMBER_ME_COOKIE_NAME = config.get('rememberMe.cookieName');
let redisClient;

function setRedisClient(client) {
  redisClient = client;
}

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
      return res.status(401).send({ message: 'Invalid token provided.' });
    }
  }
  catch (err) {
    apiLogger.info(formatApiLogMessage(`Invalid token - error parsing cookie or header token: ${err}`, req));
    return res.status(401).send({ message: 'Invalid token provided.' });
  }
}

function adminGuard(req, res, next) {
  if(req.role !== 'admin') {
    apiLogger.info(formatApiLogMessage(`Unauthorized request`, req));
    return res.status(403).send({ message: 'Not authorized.' });
  }
  else {
    next();
  }
}

function authenticate(req, res) {
  // validate request for expected parameters
  if(!req.body.hasOwnProperty('userName') || !req.body.hasOwnProperty('password')) {
    apiLogger.info(formatApiLogMessage('invalid authentication request: ' + JSON.stringify(req.body), req));
    res.status(400).send({ message: 'invalid request' });
  }
  else {
    User.findOne({ userName : req.body.userName }, '-email -lastName', (err, user) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Authentication request failed - error finding user '${req.body.userName}': ${err}`, req));
        res.json({ message: 'error during find user', error: err });
      }

      if (user) {
        // check if user account is locked
        if(user.lockoutExpiration > new Date()) {
          apiLogger.info(formatApiLogMessage(`Account for user ${user.userName} is locked out. Lockout expiration is ${user.lockoutExpiration}.`, req));
          res.json({ message: 'user account is locked out' });
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

                res.json({ message: 'user account is locked out' });
              }
              else {
                redisClient.setex('login-failures:' + user._id, 1200, ++failures);
                res.json({ message: 'login failed' });
              }
            });
          }
        }
      } else {
        apiLogger.info(formatApiLogMessage(`Login failed - could not find user '${req.body.userName}'`, req));
        res.json({ message: 'login failed' });
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
        return res.json({ message: 'error during find user', error: err });
      }

      if (user) {
        // check if user account is locked
        if(user.lockoutExpiration > new Date()) {
          apiLogger.info(formatApiLogMessage(`Account for user ${user.userName} is locked out. Lockout expiration is ${user.lockoutExpiration}.`, req));
          return res.json({ message: 'user account is locked out' });
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
        return res.status(401).send({ message: 'Invalid token provided.' });
      }
    });
  }
  else {
    apiLogger.info(formatApiLogMessage(`No rememberMe token provided.`, req));
    return res.status(401).send({ message: 'Invalid token provided.' });
  }
}

function generateAuthTokens(user) {
  const sessionToken = jwt.sign({ userName: user.userName, role: user.role, groupId: user.groupId }, process.env.TOKEN_SECRET, {
    expiresIn: 1200
  });
  const cookieToken = jwt.sign({ userName: user.userName, role: user.role, groupId: user.groupId, cookie: true }, process.env.COOKIE_TOKEN_SECRET, {
    expiresIn: 1200
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
      res.cookie(REMEMBER_ME_COOKIE_NAME, newToken._id, { expires: expiration, httpOnly: true, signed: true });
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

  res.json({
    message: 'login success',
    user : user,
    token : token
  });
}

let routes = router();
routes.post('', authenticate);
routes.get('', getNewSessionForRememberedUser);

module.exports = { routes, authenticationGuard, adminGuard, setRedisClient };