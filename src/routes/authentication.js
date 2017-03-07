let router = require('express').Router;
let User = require('../models/users');
let logging = require('../logging');
let apiLogger = logging.apiLogger;
let formatApiLogMessage = logging.formatApiLogMessage;
let bcrypt = require('bcryptjs');
let redis = require('redis');
let config = require('config');
let jwt = require('jsonwebtoken');

const redisConfig = config.get('redisConfig');
const redisClient = redis.createClient(redisConfig.port, redisConfig.host);

function authenticationGuard(req, res, next) {
  try {
    let cookieToken = jwt.verify(req.session.token, process.env.COOKIE_TOKEN_SECRET);
    let headerToken = jwt.verify(req.headers['credit-cards-authentication'], process.env.TOKEN_SECRET);

    if(headerToken.userName === cookieToken.userName && headerToken.role === cookieToken.role
      && headerToken.groupId === cookieToken.groupId) {
      req.role = headerToken.role;
      req.groupId = headerToken.groupId;
      req.userName = headerToken.userName;
      next();
    }
    else {
      apiLogger.info(formatApiLogMessage(`Invalid tokens - content does not match`, req));
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
  if(!req.body.hasOwnProperty('userName') || !req.body.hasOwnProperty('password')
   || !req.body.hasOwnProperty('rememberMe')) {
    apiLogger.info(formatApiLogMessage('invalid authentication request: ' + JSON.stringify(req.body), req));
    res.status(400).send({ message: 'invalid request' });
  }
  else {
    User.findOne({ userName : req.body.userName }, '-email', (err, user) => {
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
            const sessionToken = jwt.sign({ userName: user.userName, role: user.role, groupId: user.groupId }, process.env.TOKEN_SECRET, {
              expiresIn: 1200
            });
            const cookieToken = jwt.sign({ userName: user.userName, role: user.role, groupId: user.groupId, cookie: true }, process.env.COOKIE_TOKEN_SECRET, {
              expiresIn: 1200
            });
            req.session.token = cookieToken;
            apiLogger.info(formatApiLogMessage(`User '${user.userName}' has logged in successfully`, req));

            user.password = undefined;
            res.json({
              message: 'login success',
              user : user,
              token : sessionToken
            });
          }
          else {
            apiLogger.info(formatApiLogMessage(`Incorrect password for user '${user.userName}'`, req));

            // increment login failures in cache and lock user account if necessary
            redisClient.get('login-failures:' + user._id, (error, failures) => {
              if(failures === '4') {
                let expiration = new Date();
                expiration.setDate(expiration.getDate() + 1);
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

let routes = router();
routes.post('', authenticate);

module.exports = { routes, authenticationGuard, adminGuard };