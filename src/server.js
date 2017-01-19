import mongoose from 'mongoose';
import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes/all';
import logger from './logger';
import config from 'config';
import fs from 'fs';
import simpleEncryptor from 'simple-encryptor';
import cookieSession from 'cookie-session';

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
app.use(bodyParser.json());
app.use(cookieSession({
  name: 'credit-cards-session',
  secret: process.env.COOKIE_SECRET,
  maxAge: 20 * 60 * 1000
}));
// body-parser urlencode?
app.use('/', routes);

let serverPort = config.get('serverConfig.port');
app.listen(serverPort, () => {
  logger.info(`Server has started and is listening at port ${serverPort}.`);
});
