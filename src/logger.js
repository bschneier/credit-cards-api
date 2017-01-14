import winston from 'winston';
import fs from 'fs';
import DailyRollingFile from 'winston-daily-rotate-file';
import config from 'config';

const logConfig = config.get('loggingConfig');

// Create the log directory if it does not exist
fs.access(logConfig.directory, fs.constants.F_OK | fs.constants.W_OK, (err) => {
  if(err){
    if (err.code === "ENOENT") {
      fs.mkdirSync(logConfig.directory);
    } else {
      throw err;
    }
  }
});

const tsFormat = () => (new Date()).toLocaleTimeString();

export default new (winston.Logger)({
  transports: [
    new DailyRollingFile({
      filename: `${logConfig.directory}/${logConfig.fileName}`,
      timestamp: tsFormat,
      handleExceptions: true,
      humanReadableUnhandledException: true,
      datePattern: logConfig.datePattern,
      prepend: false,
      level: logConfig.logLevel,
      localTime: true
    })
  ]
});
