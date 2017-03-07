let express = require('express');
let bodyParser = require('body-parser');
let routes = require('./routes/all');
let apiLogger = require('./logging').apiLogger;
let config = require('config');
let cookieSession = require('cookie-session');

function startServer(cookieSecret) {
  // configure and start express server
  let app = express();
  app.disable('x-powered-by');
  app.use(bodyParser.json());
  // set 'secure: true' cookie option once SSL is implemented
  app.use(cookieSession({
    name: 'credit-cards-session',
    secret: cookieSecret,
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