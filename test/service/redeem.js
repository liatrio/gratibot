const sinon = require("sinon");
const expect = require("chai").expect;
const redeem = require("../../service/redeem");
const rewardCollection = require("../../database/rewardCollection");

function stubFindSortToArray(results) {
  const toArray = sinon.stub().resolves(results);
  const sort = sinon.stub().returns({ toArray });
  const find = sinon.stub(rewardCollection, "find").returns({ sort });
  return { find, sort, toArray };
}

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
    it("should parse name, cost, and kind from the payload", async () => {
      const expectedItemDetails = {
        itemName: "testName",
        itemCost: 100,
        kind: "liatrio-store",
      };
      const actualSelectedItemDetails = redeem.getSelectedItemDetails(
        '{"name": "testName", "cost": 100, "kind": "liatrio-store"}',
      );
      expect(actualSelectedItemDetails).to.deep.eq(expectedItemDetails);
    });

    it("should default kind to null when not present on the payload", async () => {
      const actual = redeem.getSelectedItemDetails(
        '{"name":"Sticker","cost":5}',
      );
      expect(actual).to.deep.eq({
        itemName: "Sticker",
        itemCost: 5,
        kind: null,
      });
    });
  });

  describe("createRedeemBlocks", () => {
    it("returns header and help-text blocks and queries active rewards", async () => {
      const { find, sort, toArray } = stubFindSortToArray([]);

      const actualBlocks = await redeem.createRedeemBlocks(100);

      expect(find.calledWith({ active: true })).to.equal(true);
      expect(sort.calledWith({ sortOrder: 1, name: 1 })).to.equal(true);
      expect(toArray.calledOnce).to.equal(true);
      expect(actualBlocks[0]).to.deep.eq({
        type: "header",
        text: { type: "plain_text", text: "Gratibot Rewards" },
      });
      expect(actualBlocks[1]).to.deep.eq({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Take a look at the currently available rewards!\nBalance: 100`,
        },
      });
    });

    it("renders only active rewards, sorted by sortOrder then name", async () => {
      // DB would sort for us; we feed in the already-sorted set here to
      // assert the block order mirrors the DB sort (active-only, sortOrder
      // ascending, name tiebreak).
      const rewards = [
        {
          name: "Alpha",
          description: "a",
          cost: 1,
          imageURL: "http://a",
          sortOrder: 0,
        },
        {
          name: "Bravo",
          description: "b",
          cost: 2,
          imageURL: "http://b",
          sortOrder: 1,
        },
        {
          name: "Charlie",
          description: "c",
          cost: 3,
          imageURL: "http://c",
          sortOrder: 1,
        },
      ];
      stubFindSortToArray(rewards);

      const blocks = await redeem.createRedeemBlocks(10);

      // blocks[0] header, blocks[1] help, blocks[2..4] item rows, last = selector
      const itemTexts = blocks
        .slice(2, 2 + rewards.length)
        .map((b) => b.text.text);
      expect(itemTexts[0]).to.include("*Alpha*");
      expect(itemTexts[1]).to.include("*Bravo*");
      expect(itemTexts[2]).to.include("*Charlie*");

      const selector = blocks[blocks.length - 1];
      const optionNames = selector.accessory.options.map((o) => o.text.text);
      expect(optionNames).to.deep.equal(["Alpha", "Bravo", "Charlie"]);
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
    it("serializes option.value including kind when present", async () => {
      const gratibotRewards = [
        {
          name: "Liatrio Store",
          cost: "0",
          kind: "liatrio-store",
        },
      ];

      const block = redeem.redeemSelector(gratibotRewards);
      expect(block.accessory.options).to.have.length(1);
      const parsed = JSON.parse(block.accessory.options[0].value);
      expect(parsed).to.deep.equal({
        name: "Liatrio Store",
        cost: "0",
        kind: "liatrio-store",
      });
    });

    it("serializes option.value with kind: null when absent", async () => {
      const gratibotRewards = [{ name: "Sticker", cost: "5" }];

      const block = redeem.redeemSelector(gratibotRewards);
      const parsed = JSON.parse(block.accessory.options[0].value);
      expect(parsed).to.deep.equal({
        name: "Sticker",
        cost: "5",
        kind: null,
      });
    });

    it("returns expected selector shell", async () => {
      const gratibotRewards = [
        {
          name: "test",
          cost: "10",
        },
      ];

      const block = redeem.redeemSelector(gratibotRewards);
      expect(block.type).to.equal("section");
      expect(block.accessory.type).to.equal("static_select");
      expect(block.accessory.action_id).to.equal("redeem");
      expect(block.accessory.placeholder.text).to.equal("Select an item");
      expect(block.accessory.options[0].text.text).to.equal("test");
    });
  });
});
