let mongoose = require('mongoose');
let express = require('express');
let bodyParser = require('body-parser');
let routes = require('./routes/all');
let apiLogger = require('./logging').apiLogger;
let config = require('config');
let fs = require('fs');
let simpleEncryptor = require('simple-encryptor');
let cookieSession = require('cookie-session');

// get encryption key from file, save in environment variable, and delete file
const keyFile = config.get('keyConfig.filePath');
let buf = new Buffer(1024);
let file = fs.openSync(keyFile, 'r+');
let bytes = fs.readSync(file, buf, 0, buf.length, 0);
fs.closeSync(file);
if(bytes >= 0) {
  const keys = buf.slice(0, bytes).toString().split(',');
  // do we really need to store this in an environment variable? Is
  // this going to be used anywhere else?
  process.env.ENCRYPTION_KEY = keys[0];
  process.env.TOKEN_SECRET = keys[1];
  // same with the cookie secret -> using anywhere else?
  process.env.COOKIE_SECRET = keys[2];
  process.env.COOKIE_TOKEN_SECRET = keys[3];
  fs.unlink(keyFile, function(err) {
    if (err) {
      throw err;
    }
  });
}
else {
  throw new Error(`${keyFile} is empty`);
}

// mongoose defaults to their own promise library - mpromise,
// which is deprecated, use ES6 promises instead
mongoose.Promise = Promise;

// connect to mongoDB
const dbConfig = config.get('dbConfig');
const encryptor = simpleEncryptor(process.env.ENCRYPTION_KEY);
const dbPassword = encryptor.decrypt(dbConfig.password);
mongoose.connect('mongodb://' + dbConfig.username
 + ':' + dbPassword + '@' + dbConfig.host
 + ':' + dbConfig.port + '/' + dbConfig.database
 + '?authSource=admin');

// configure and start express server
let app = express();
app.disable('x-powered-by');
app.use(bodyParser.json());
// set 'secure: true' cookie option once SSL is implemented
app.use(cookieSession({
  name: 'credit-cards-session',
  secret: process.env.COOKIE_SECRET,
  maxAge: 20 * 60 * 1000,
  httpOnly: true
}));
app.use('/', routes);

let serverPort = config.get('serverConfig.port');
app.listen(serverPort, () => {
  apiLogger.info(`Server has started and is listening at port ${serverPort}.`);
});

module.exports = app;