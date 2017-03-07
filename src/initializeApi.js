let startServer = require('./server');
let config = require('config');
let fs = require('fs');
let mongoose = require('mongoose');
let simpleEncryptor = require('simple-encryptor');

let encryptionKey, cookieSecret;

// get encryption key from file, save in environment variable, and delete file
const keyFile = config.get('keyConfig.filePath');
let buf = new Buffer(1024);
let file = fs.openSync(keyFile, 'r+');
let bytes = fs.readSync(file, buf, 0, buf.length, 0);
fs.closeSync(file);
if(bytes >= 0) {
  const keys = buf.slice(0, bytes).toString().split(',');
  // do we really need to store ENCRYPTION_KEY and COOKIE_SECRET in
  // environment variables? Are they going to be used anywhere else?
  encryptionKey = keys[0];
  process.env.TOKEN_SECRET = keys[1];
  cookieSecret = keys[2];
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
const encryptor = simpleEncryptor(encryptionKey);
const dbPassword = encryptor.decrypt(dbConfig.password);
mongoose.connect('mongodb://' + dbConfig.username
+ ':' + dbPassword + '@' + dbConfig.host
+ ':' + dbConfig.port + '/' + dbConfig.database
+ '?authSource=admin');

startServer(cookieSecret);