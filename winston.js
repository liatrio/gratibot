const { createLogger, format, transports } = require("winston");
const { combine, timestamp, prettyPrint } = format;

const config = require("./config");

const loggingLevel = config.logLevel;

const logger = createLogger({
  label: timestamp(),
  level: loggingLevel,
  format: combine(timestamp(), prettyPrint()),
  transports: [new transports.Console({ level: loggingLevel })],
});

module.exports = logger;
