const winston = require('winston');
const config = require('./config')
const loggingLevel = config.logLevel

winston.configure({
  level: loggingLevel,
  transports: [
    new winston.transports.Console({
      format: winston.format.json(),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.json(),
    }),
  ],
});

module.exports = winston;
