// Root hooks for integration tests.
//
// Starts an in-memory MongoDB before the suite and stops it after. The URI is
// patched onto the cached config module. config.js is required transitively
// by test/setup.js -> winston.js before this hook runs, so setting
// process.env.MONGO_URL alone is not enough — the default URL has already
// been read and cached. Mutating config.mongo_url works because database/db.js
// re-reads it from the cached config object when it is first required (which
// the test file does inside its own before() hook).

const { MongoMemoryServer } = require("mongodb-memory-server");
const config = require("../../config");

let mongod;

exports.mochaHooks = {
  async beforeAll() {
    // First boot may need to download the MongoDB binary.
    this.timeout(120000);
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_URL = uri;
    config.mongo_url = uri;
  },
  async afterAll() {
    if (mongod) {
      await mongod.stop();
    }
  },
};
