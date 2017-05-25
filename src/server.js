const express = require('express');
const bodyParser = require('body-parser');
const addRequestId = require('express-request-id')();
const config = require('config');
const cookieSession = require('cookie-session');
const srs = require('secure-random-string');
const cookieParser = require('cookie-parser');
const routes = require('./routes/all');
const apiLogger = require('./logging').apiLogger;

process.env.TOKEN_SECRET = srs();
process.env.COOKIE_TOKEN_SECRET = srs();

// configure and start express server
let app = express();
app.disable('x-powered-by');
app.use(bodyParser.json());
app.use(addRequestId);
/*
  Keeping the cookie secret static here instead of dynamically generating new secret with srs()
  so that tokens will continue to work if API is restarted within expiration period
*/
app.use(cookieParser(config.get('rememberMe.cookieSecret')));
// TODO: set 'secure: true' cookie option once SSL is implemented
app.use(cookieSession({
  name: config.get('session.cookieName'),
  secret: srs(),
  maxAge: config.get('session.expirationMinutes') * 60 * 1000,
  domain: config.get('cookieDomain'),
  httpOnly: true
}));
app.use('/', routes);

let serverPort = config.get('server.port');
app.listen(serverPort, () => {
  apiLogger.info(`Server has started and is listening at port ${serverPort}.`);
});

module.exports = app;