import { Router as router } from 'express';
import User from '../models/users';
import { apiLogger, formatApiLogMessage } from '../logging';
import bcrypt from 'bcryptjs';
import redis from 'redis';
import config from 'config';
import jwt from 'jsonwebtoken';

const AUTH_RESPONSES = {
  LOCKED_OUT : "LockedOut",
  LOGIN_SUCCESS : "LoginSuccess",
  LOGIN_FAIL : "LoginFail",
  ERROR : "Error",
  INVALID_REQUEST : "InvalidRequest"
};

const redisConfig = config.get('redisConfig');
const redisClient = redis.createClient(redisConfig.port, redisConfig.host);

let routes = router();
routes.post('', (req, res) => {
  // validate request for expected parameters
  if(!req.body.hasOwnProperty('userName') || !req.body.hasOwnProperty('password')
   || !req.body.hasOwnProperty('rememberMe')) {
    apiLogger.info(formatApiLogMessage('invalid authentication request: ' + JSON.stringify(req.body), req));
    res.json({info: 'invalid request', data: {responseCode : AUTH_RESPONSES.INVALID_REQUEST}});
  }
  else {
    User.findOne({ userName : req.body.userName }, '-email', (err, user) => {
      if (err) {
        apiLogger.error(formatApiLogMessage(`Authentication request failed - error finding user '${req.body.userName}': ${err}`, req));
        res.json({info: 'error during find user', data: {responseCode : AUTH_RESPONSES.ERROR}, error: err});
      }

      if (user) {
        // check if user account is locked
        if(user.lockoutExpiration > new Date()) {
          apiLogger.info(formatApiLogMessage(`Account for user ${user.userName} is locked out. Lockout expiration is ${user.lockoutExpiration}.`, req));
          res.json({info: 'user account is locked out', data: {responseCode : AUTH_RESPONSES.LOCKED_OUT}});
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

            user.password = undefined;
            res.json({
              info: 'login success',
              responseCode : AUTH_RESPONSES.LOGIN_SUCCESS,
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

                res.json({info: 'user account is locked out', data: {responseCode : AUTH_RESPONSES.LOCKED_OUT}});
              }
              else {
                redisClient.setex('login-failures:' + user._id, 1200, ++failures);
                res.json({info: 'login failed', data: {responseCode : AUTH_RESPONSES.LOGIN_FAIL}});
              }
            });
          }
        }
      } else {
        apiLogger.info(formatApiLogMessage(`Login failed - could not find user '${req.body.userName}'`, req));
        res.json({info: 'login failed', data: {responseCode : AUTH_RESPONSES.LOGIN_FAIL}});
      }
    });
  }
});

export { routes as authenticationRoutes };

export function authenticationGuard(req, res, next) {
  try {
    let cookieToken = jwt.verify(req.session.token, process.env.COOKIE_TOKEN_SECRET);
    let headerToken = jwt.verify(req.headers['credit-cards-authentication'], process.env.TOKEN_SECRET);

    if(headerToken.userName === cookieToken.userName && headerToken.role === cookieToken.role
      && headerToken.groupId == cookieToken.groupId) {
      req.role = headerToken.role;
      req.groupId = headerToken.groupId;
      req.userName = headerToken.userName;
      next();
    }
    else {
      apiLogger.info(formatApiLogMessage(`Invalid tokens - content does not match`, req));
      return res.status(401).send({
        success: false,
        message: 'Invalid token provided.'
      });
    }
  }
  catch (err) {
    apiLogger.info(formatApiLogMessage(`Invalid token - error parsing cookie or header token: ${err}`, req));
    return res.status(401).send({
      success: false,
      message: 'Invalid token provided.'
    });
  }

}

export function adminGuard(req, res, next) {
  if(req.role !== 'admin') {
    apiLogger.info(formatApiLogMessage(`Unauthorized request`, req));
    return res.status(403).send({
      success: false,
      message: 'Not authorized.'
    });
  }
  else {
    next();
  }
}