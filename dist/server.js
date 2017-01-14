'use strict';

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _all = require('./routes/all');

var _all2 = _interopRequireDefault(_all);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _simpleEncryptor = require('simple-encryptor');

var _simpleEncryptor2 = _interopRequireDefault(_simpleEncryptor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// get encryption key from file, save in environment variable, and delete file
var keyFile = _config2.default.get('keyConfig.filePath');
var buf = new Buffer(1024);
var file = _fs2.default.openSync(keyFile, 'r+');
var bytes = _fs2.default.readSync(file, buf, 0, buf.length, 0);
_fs2.default.closeSync(file);
if (bytes >= 0) {
  process.env.ENCRYPTION_KEY = buf.slice(0, bytes).toString();
  _fs2.default.unlink(keyFile, function (err) {
    if (err) {
      throw err;
    }
  });
} else {
  throw new Error(keyFile + ' is empty');
}

// connect to mongoDB
var dbConfig = _config2.default.get('dbConfig');
var encryptor = (0, _simpleEncryptor2.default)(process.env.ENCRYPTION_KEY);
var dbPassword = encryptor.decrypt(dbConfig.password);
_mongoose2.default.connect('mongodb://' + dbConfig.username + ':' + dbPassword + '@' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database + '?authSource=admin');

var app = (0, _express2.default)();
app.use(_bodyParser2.default.json());
// body-parser urlencode?
app.use('/', _all2.default);

var serverPort = _config2.default.get('serverConfig.port');
app.listen(serverPort, function () {
  _logger2.default.info('Server has started and is listening at port ' + serverPort + '.');
});