const { createLogger, format, transports } = require("winston");
const { combine, timestamp, json } = format;

const config = require("./config");

const loggingLevel = config.logLevel;

const logger = createLogger({
  label: timestamp(),
  level: loggingLevel,
  format: combine(timestamp(), json()),
  transports: [new transports.Console({ level: loggingLevel })],
});

module.exports = logger;
