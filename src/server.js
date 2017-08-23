const express = require('express');
const bodyParser = require('body-parser');
const addRequestId = require('express-request-id')();
const config = require('config');
const expressSession = require('express-session');
const srs = require('secure-random-string');
const cookieParser = require('cookie-parser');
const routes = require('./routes/all');
const apiLogger = require('./logging').apiLogger;

process.env.TOKEN_SECRET = srs();

// configure and start express server
let app = express();
app.disable('x-powered-by');
app.use(bodyParser.json());
app.use(addRequestId);
/*
  Keeping the cookie secret static here instead of dynamically generating new secret with srs()
  so that tokens will continue to work if API is restarted within expiration period
*/
const cookieSecret = config.get('cookieSecret');
app.use(cookieParser(cookieSecret));
// TODO: set 'secure: true' cookie option once SSL is implemented
// expressSession must use same secret for cookie as cookieParser
app.use(expressSession({
  cookie: {
    maxAge: config.get('session.expirationMinutes') * 60 * 1000,
    domain: config.get('cookieDomain'),
    httpOnly: true
  },
  name: config.get('session.cookieName'),
  resave: true,
  rolling: true,
  saveUninitialized: false,
  secret: cookieSecret
}));
app.use('/', routes);

let serverPort = config.get('server.port');
app.listen(serverPort, () => {
  apiLogger.info(`Server has started and is listening at port ${serverPort}.`);
});

module.exports = app;