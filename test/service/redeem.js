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

  describe("fetchActiveRewardById", () => {
    it("queries by _id and active flag when id is a valid ObjectId", async () => {
      const findOne = sinon
        .stub(rewardCollection, "findOne")
        .resolves({ _id: "stub" });

      await redeem.fetchActiveRewardById("507f1f77bcf86cd799439011");

      expect(findOne.calledOnce).to.equal(true);
      const filter = findOne.firstCall.args[0];
      expect(filter.active).to.equal(true);
      expect(String(filter._id)).to.equal("507f1f77bcf86cd799439011");
    });

    it("returns null for an invalid ObjectId without hitting the collection", async () => {
      const findOne = sinon.stub(rewardCollection, "findOne");

      const result = await redeem.fetchActiveRewardById("not-an-object-id");

      expect(result).to.equal(null);
      expect(findOne.called).to.equal(false);
    });
  });

  describe("fetchActiveRewards", () => {
    it("queries active rewards sorted by sortOrder then name", async () => {
      const { find, sort, toArray } = stubFindSortToArray([]);

      await redeem.fetchActiveRewards();

      expect(find.calledWith({ active: true })).to.equal(true);
      expect(sort.calledWith({ sortOrder: 1, name: 1 })).to.equal(true);
      expect(toArray.calledOnce).to.equal(true);
    });
  });

  describe("buildRedeemBlocks", () => {
    it("returns header and help-text blocks with the given balance", () => {
      const actualBlocks = redeem.buildRedeemBlocks([], 100);

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

    it("renders rewards in the order given", () => {
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

      const blocks = redeem.buildRedeemBlocks(rewards, 10);

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
    it("serializes option.value as the reward _id string", async () => {
      const gratibotRewards = [
        {
          _id: "507f1f77bcf86cd799439011",
          name: "Liatrio Store",
          cost: 0,
          kind: "liatrio-store",
        },
      ];

      const block = redeem.redeemSelector(gratibotRewards);
      expect(block.accessory.options).to.have.length(1);
      expect(block.accessory.options[0].value).to.equal(
        "507f1f77bcf86cd799439011",
      );
    });

    it("coerces non-string _id (e.g. ObjectId) to a string", async () => {
      const gratibotRewards = [
        {
          _id: { toString: () => "507f1f77bcf86cd799439011" },
          name: "Sticker",
          cost: 5,
        },
      ];

      const block = redeem.redeemSelector(gratibotRewards);
      expect(block.accessory.options[0].value).to.equal(
        "507f1f77bcf86cd799439011",
      );
    });

    it("returns expected selector shell", async () => {
      const gratibotRewards = [
        {
          _id: "id-1",
          name: "test",
          cost: 10,
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
