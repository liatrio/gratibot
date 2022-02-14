const sinon = require("sinon");
const expect = require("chai").expect;                      
const redeem = require("../../service/redeem");

describe("service/redeem", () => {
  afterEach(() => {                                                                    
    sinon.restore();                               
  });

  describe("createMPIM", () => { 
    it("should return comma seperated list of users", async () => {
      const actualMPIMGroup = redeem.createMPIM("TestUser2", ["Admin1", "Admin2"]); 
      expect(actualMPIMGroup).to.eq("TestUser2, Admin1, Admin2");
    });
  })

  describe("getSelectedItemDetails", () => { 
    it("should return comma seperated list of users", async () => {
      const expectedItemDetails = {
        itemName: "testName",
        itemCost: 100
      }
      const actualSelectedItemDetails = redeem.getSelectedItemDetails('{"name": "testName", "cost": 100}');
      expect(actualSelectedItemDetails).to.deep.eq(expectedItemDetails);
    });
  })
});
