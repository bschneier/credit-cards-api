let express = require('express');
let bodyParser = require('body-parser');
let routes = require('./routes/all');
let apiLogger = require('./logging').apiLogger;
let config = require('config');
let cookieSession = require('cookie-session');
let srs = require('secure-random-string');

function startServer() {
  process.env.TOKEN_SECRET = srs();
  process.env.COOKIE_TOKEN_SECRET = srs();

  // configure and start express server
  let app = express();
  app.disable('x-powered-by');
  app.use(bodyParser.json());
  // TODO: set 'secure: true' cookie option once SSL is implemented
  app.use(cookieSession({
    name: 'credit-cards-session',
    secret: srs(),
    maxAge: 20 * 60 * 1000,
    httpOnly: true
  }));
  app.use('/', routes);

  let serverPort = config.get('serverConfig.port');
  app.listen(serverPort, () => {
    apiLogger.info(`Server has started and is listening at port ${serverPort}.`);
  });

  return app;
}

module.exports = startServer;