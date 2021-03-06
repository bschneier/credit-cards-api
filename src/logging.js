const winston = require('winston');
const fs = require('fs');
const DailyRollingFile = require('winston-daily-rotate-file');
const config = require( 'config');

const apiLogConfig = config.get('apiLogging');
const frontEndLogConfig = config.get('frontEndLogging');
const logDirectories = [apiLogConfig.directory, frontEndLogConfig.directory];

// Create the log directories if they do not exist
for(let directory of logDirectories) {
  try {
    fs.access(directory, fs.constants.F_OK | fs.constants.W_OK, (err) => {
      if(err){
        if (err.code === "ENOENT") {
          fs.mkdirSync(directory);
        } else {
          throw err;
        }
      }
    });
  }
  catch(error) {
    console.log(error); // eslint-disable-line no-console
  }
}

const tsFormat = () => (new Date()).toLocaleTimeString();

// logger used internally by api to record api info
const apiLogger = new (winston.Logger)({
  transports: [
    new DailyRollingFile({
      filename: `${apiLogConfig.directory}/${apiLogConfig.fileName}`,
      timestamp: tsFormat,
      handleExceptions: true,
      humanReadableUnhandledException: true,
      datePattern: apiLogConfig.datePattern,
      prepend: false,
      level: apiLogConfig.logLevel,
      localTime: true
    })
  ]
});

// logger called by external front end to record front end info
const frontEndLogger = new (winston.Logger)({
  transports: [
    new DailyRollingFile({
      filename: `${frontEndLogConfig.directory}/${frontEndLogConfig.fileName}`,
      timestamp: tsFormat,
      handleExceptions: false,
      humanReadableUnhandledException: true,
      datePattern: frontEndLogConfig.datePattern,
      prepend: false,
      level: frontEndLogConfig.logLevel,
      localTime: true
    })
  ]
});

function formatApiLogMessage(message, req) {
  let ip = req.connection.remoteAddress || req.socket.remoteAddress;
  return {
    message: message,
    request_id: req.id,
    ip_address: ip.split(':')[3],
    url_requested: req.method + ' ' + req.protocol + '://' + req.hostname + req.originalUrl
  };
}

function formatFrontEndLogMessage(req) {
  let ip = req.connection.remoteAddress || req.socket.remoteAddress;
  return {
    operatingSystem: req.body.operatingSystem,
    browser: req.body.browser,
    url: req.body.url,
    stackTrace: req.body.stackTrace,
    message: req.body.message,
    request_id: req.id,
    ipAddress: ip.split(':')[3]
  };
}

module.exports = { apiLogger, frontEndLogger, formatApiLogMessage, formatFrontEndLogMessage };