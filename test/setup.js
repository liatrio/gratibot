const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const winston = require("../winston");

winston.silent = true;
chai.use(chaiAsPromised);
