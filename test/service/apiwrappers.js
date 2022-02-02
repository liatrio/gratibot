const sinon = require("sinon");
const expect = require("chai").expect;
const assert = require("chai").assert;

const { SlackError } = require("../../service/errors");
const apiwrappers = require("../../service/apiwrappers");


describe("service/apiwrappers", () => {
  describe("userInfo", () => {
    it("should return the user on success", async () => {
      const mockClient =  {
        users: {
          info: async function (obj) {
            return new Promise((resolve) => resolve({
              ok: true,
              user: obj.user,
            }));
          }
        }
      }

      const info = await apiwrappers.userInfo(mockClient, "testUser");
      expect(info).to.equal("testUser");
    });

    it("throw an error on unsuccessful response", async () => {
      const mockClient =  {
        users: {
          info: async function (obj) {
            return new Promise((resolve) => resolve({
              ok: false,
              user: obj.user,
            }));
          }
        }
      }

      expect(async () => { await apiwrappers.userInfo(mockClient, "testUser") }).to.throw;
    });
  });
});
