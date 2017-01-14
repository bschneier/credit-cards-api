'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _winstonDailyRotateFile = require('winston-daily-rotate-file');

var _winstonDailyRotateFile2 = _interopRequireDefault(_winstonDailyRotateFile);

var _config = require('config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var logConfig = _config2.default.get('loggingConfig');

// Create the log directory if it does not exist
_fs2.default.access(logConfig.directory, _fs2.default.constants.F_OK | _fs2.default.constants.W_OK, function (err) {
  if (err) {
    if (err.code === "ENOENT") {
      _fs2.default.mkdirSync(logConfig.directory);
    } else {
      throw err;
    }
  }
});

var tsFormat = function tsFormat() {
  return new Date().toLocaleTimeString();
};

exports.default = new _winston2.default.Logger({
  transports: [new _winstonDailyRotateFile2.default({
    filename: logConfig.directory + '/' + logConfig.fileName,
    timestamp: tsFormat,
    handleExceptions: true,
    humanReadableUnhandledException: true,
    datePattern: logConfig.datePattern,
    prepend: false,
    level: logConfig.logLevel,
    localTime: true
  })]
});