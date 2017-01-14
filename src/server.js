import mongoose from 'mongoose';
import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes/all';
import logger from './logger';
import config from 'config';
import fs from 'fs';
import simpleEncryptor from 'simple-encryptor';

// get encryption key from file, save in environment variable, and delete file
const keyFile = config.get('keyConfig.filePath');
let buf = new Buffer(1024);
let file = fs.openSync(keyFile, 'r+');
let bytes = fs.readSync(file, buf, 0, buf.length, 0);
fs.closeSync(file);
if(bytes >= 0) {
  process.env.ENCRYPTION_KEY = buf.slice(0, bytes).toString();
  fs.unlink(keyFile, function(err) {
    if (err) {
      throw err;
    }
  });
}
else {
  throw new Error(`${keyFile} is empty`);
}

// connect to mongoDB
const dbConfig = config.get('dbConfig');
const encryptor = simpleEncryptor(process.env.ENCRYPTION_KEY);
const dbPassword = encryptor.decrypt(dbConfig.password);
mongoose.connect('mongodb://' + dbConfig.username
 + ':' + dbPassword + '@' + dbConfig.host
 + ':' + dbConfig.port + '/' + dbConfig.database
 + '?authSource=admin');

let app = express();
app.use(bodyParser.json());
// body-parser urlencode?
app.use('/', routes);

let serverPort = config.get('serverConfig.port');
app.listen(serverPort, () => {
  logger.info(`Server has started and is listening at port ${serverPort}.`);
});
