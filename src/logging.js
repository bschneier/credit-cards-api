import winston from 'winston';
import fs from 'fs';
import DailyRollingFile from 'winston-daily-rotate-file';
import config from 'config';

const apiLogConfig = config.get('apiLoggingConfig');
const frontEndLogConfig = config.get('frontEndLoggingConfig');
const logDirectories = [apiLogConfig.directory, frontEndLogConfig.directory];

// Create the log directories if they do not exist
for(let directory of logDirectories) {
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

const tsFormat = () => (new Date()).toLocaleTimeString();

// logger used internally by api to record api info
export const apiLogger = new (winston.Logger)({
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
export const frontEndLogger = new (winston.Logger)({
  transports: [
    new DailyRollingFile({
      filename: `${frontEndLogConfig.directory}/${frontEndLogConfig.fileName}`,
      timestamp: tsFormat,
      handleExceptions: true,
      humanReadableUnhandledException: true,
      datePattern: frontEndLogConfig.datePattern,
      prepend: false,
      level: frontEndLogConfig.logLevel,
      localTime: true
    })
  ]
});

export function formatApiLogMessage(message, req) {
  let ip = req.connection.remoteAddress || req.socket.remoteAddress;
  return {
    message: message,
    ip_address: ip.split(':')[3],
    url_requested: req.method + ' ' + req.protocol + '://' + req.hostname + req.originalUrl
  };
}

export function formatFrontEndLogMessage(req) {
  let ip = req.connection.remoteAddress || req.socket.remoteAddress;
  return {
    operatingSystem: req.body.operatingSystem,
    browser: req.body.browser,
    url: req.body.url,
    stackTrace: req.body.stackTrace,
    message: req.body.message,
    ipAddress: ip.split(':')[3]
  };
}