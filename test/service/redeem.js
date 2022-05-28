const sinon = require("sinon");
const expect = require("chai").expect;
const redeem = require("../../service/redeem");

describe("service/redeem", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("redeemNotificationUsers", () => {
    it("should return comma seperated list of users", async () => {
      const actualMPIMGroup = redeem.redeemNotificationUsers("TestUser2", [
        "Admin1",
        "Admin2",
      ]);
      expect(actualMPIMGroup).to.eq("TestUser2, Admin1, Admin2");
    });
  });

  describe("getSelectedItemDetails", () => {
    it("should return comma seperated list of users", async () => {
      const expectedItemDetails = {
        itemName: "testName",
        itemCost: 100,
      };
      const actualSelectedItemDetails = redeem.getSelectedItemDetails(
        '{"name": "testName", "cost": 100}'
      );
      expect(actualSelectedItemDetails).to.deep.eq(expectedItemDetails);
    });
  });

  describe("createRedeemBlocks", () => {
    it("returns expected blocks", async () => {
      let expectedBlocks = [];
      const expectedHeader = {
        type: "header",
        text: {
          type: "plain_text",
          text: "Gratibot Rewards",
        },
      };

      expectedBlocks.push(expectedHeader);

      const expectedHelpText = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Take a look at the currently available rewards!\nBalance: 100`,
        },
      };

      expectedBlocks.push(expectedHelpText);

      const actualBlocks = redeem.createRedeemBlocks(100);
      expect(actualBlocks[0]).to.deep.eq(expectedHeader);
      expect(actualBlocks[1]).to.deep.eq(expectedHelpText);
    });
  });

  describe("redeemHeader", () => {
    it("returns expected block", async () => {
      const expectedHeader = {
        type: "header",
        text: {
          type: "plain_text",
          text: "Gratibot Rewards",
        },
      };

      const actualHeader = redeem.redeemHeader();
      expect(actualHeader).to.deep.eq(expectedHeader);
    });
  });

  describe("redeemHelpText", () => {
    it("returns expected block", async () => {
      const expectedHelpText = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Take a look at the currently available rewards!\nBalance: 100`,
        },
      };

      const actualText = redeem.redeemHelpText(100);
      expect(actualText).to.deep.eq(expectedHelpText);
    });
  });

  describe("redeemItems", () => {
    it("returns expected block", async () => {
      const gratibotRewards = [
        {
          name: "test",
          description: "test description",
          cost: "10",
          imageURL: "http://test.com",
        },
      ];

      const expectedItemsBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*test*\ntest description\nCost: 10`,
          },
          accessory: {
            type: "image",
            image_url: "http://test.com",
            alt_text: "Image of test",
          },
        },
      ];

      const actualItemsBlocks = redeem.redeemItems(gratibotRewards);
      expect(actualItemsBlocks).to.deep.eq(expectedItemsBlocks);
    });
  });

  describe("redeemSelector", () => {
    it("returns expected block", async () => {
      const gratibotRewards = [
        {
          name: "test",
          description: "test description",
          cost: "10",
          imageUUL: "http://test.com",
        },
      ];

      const expectedSelectorBlocks = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Pick an item from the dropdown list",
        },
        accessory: {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "Select an item",
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: "test",
              },
              value: '{"name":"test","cost":"10"}',
            },
          ],
          confirm: {
            title: {
              type: "plain_text",
              text: "Are you sure?",
            },
            text: {
              type: "mrkdwn",
              text: "You're sure you want to buy?",
            },
            confirm: {
              type: "plain_text",
              text: "Yes",
            },
            deny: {
              type: "plain_text",
              text: "Stop, I've changed my mind!",
            },
          },
          action_id: "redeem",
        },
      };

      const actualSelectorBlocks = redeem.redeemSelector(gratibotRewards);
      expect(actualSelectorBlocks).to.deep.eq(expectedSelectorBlocks);
    });
  });
});
