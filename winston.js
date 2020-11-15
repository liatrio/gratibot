const winston = require("winston");
const config = require("./config");
const loggingLevel = config.logLevel;

const logger = winston.createLogger({
  level: loggingLevel,
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
  ],
});

module.exports = logger;
