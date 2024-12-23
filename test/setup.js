import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";

import winston from "../winston.js";

winston.silent = true;
chai.use(chaiAsPromised);
