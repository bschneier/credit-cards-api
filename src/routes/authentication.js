import { Router as router } from 'express';
import User from '../models/users';
import logger from '../logger';
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
    logger.info('invalid authentication request: ' + JSON.stringify(req.body));
    res.json({info: 'invalid request', data: {responseCode : AUTH_RESPONSES.INVALID_REQUEST}});
  }
  else {
    User.findOne({ userName : req.body.userName }, '-email', function (err, user) {
      if (err) {
        logger.error(`Authentication request failed - error finding user '${req.body.userName}': ${err}`);
        res.json({info: 'error during find user', data: {responseCode : AUTH_RESPONSES.ERROR}, error: err});
      }

      if (user) {
        // check if user account is locked
        if(user.lockoutExpiration > new Date()) {
          logger.info(`Account for user ${user.userName} is locked out. Lockout expiration is ${user.lockoutExpiration}.`);
          res.json({info: 'user account is locked out', data: {responseCode : AUTH_RESPONSES.LOCKED_OUT}});
        }
        else {
          // validate password
          if(bcrypt.compareSync(req.body.password, user.password)) {
            const sessionToken = jwt.sign({ userName: user.userName, role: user.role }, process.env.TOKEN_SECRET, {
              expiresIn: 1200
            });
            const cookieToken = jwt.sign({ userName: user.userName, role: user.role, cookie: true }, process.env.COOKIE_TOKEN_SECRET, {
              expiresIn: 1200
            });
            req.session.token = cookieToken;
            logger.info(`generated cookie token: ${cookieToken}`);
            logger.info(`set token in request cookie session: ${req.session.token}`);

            user.password = undefined;
            res.json({
              info: 'login success',
              responseCode : AUTH_RESPONSES.LOGIN_SUCCESS,
              user : user,
              token : sessionToken
            });
          }
          else {
            logger.info(`Incorrect password for user '${user.userName}'`);

            // increment login failures in cache and lock user account if necessary
            redisClient.get('login-failures:' + user._id, (error, failures) => {
              if(failures === '4') {
                let expiration = new Date();
                expiration.setDate(expiration.getDate() + 1);
                user.lockoutExpiration = expiration;
                user.save((err) => {
                  if(err) {
                    logger.error(`Error setting lockoutExpiration for user '${user.userName}': ${err}`);
                  }
                  else {
                    logger.info(`Set lockoutExpiration for user ${user.userName} to ${expiration}`);
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
        logger.info(`Login failed - could not find user '${req.body.userName}'`);
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

    if(headerToken.userName === cookieToken.userName && headerToken.role === cookieToken.role) {
      req.role = headerToken.role;
      req.userName = headerToken.userName;
      next();
    }
    else {
      logger.info(`Invalid tokens - content does not match`);
      return res.status(401).send({
        success: false,
        message: 'Invalid token provided.'
      });
    }
  }
  catch (err) {
    logger.info(`Invalid token - error parsing cookie or header token: ${err}`);
    return res.status(401).send({
      success: false,
      message: 'Invalid token provided.'
    });
  }

}

export function adminGuard(req, res, next) {
  if(req.role !== 'admin') {
    logger.info(`Unauthorized request`);
    return res.status(403).send({
      success: false,
      message: 'Not authorized.'
    });
  }
  else {
    next();
  }
}