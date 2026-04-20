const sinon = require("sinon");
const { ObjectId } = require("mongodb");
const expect = require("chai").expect;

const rewardAdmin = require("../../service/rewardAdmin");
const rewardCollection = require("../../database/rewardCollection");
const config = require("../../config");
const { GratitudeError } = require("../../service/errors");

function validInput(overrides) {
  return Object.assign(
    {
      name: "Sticker Pack",
      description: "A set of stickers",
      cost: 10,
      imageURL: "https://example.com/sticker.png",
      active: true,
    },
    overrides || {},
  );
}

function stubFindSortToArray(results) {
  const toArray = sinon.stub().resolves(results);
  const sort = sinon.stub().returns({ toArray });
  const find = sinon.stub(rewardCollection, "find").returns({ sort });
  return { find, sort, toArray };
}

function stubFindSortLimitToArray(results) {
  const toArray = sinon.stub().resolves(results);
  const limit = sinon.stub().returns({ toArray });
  const sort = sinon.stub().returns({ limit, toArray });
  const find = sinon.stub(rewardCollection, "find").returns({ sort });
  return { find, sort, limit, toArray };
}

describe("service/rewardAdmin", function () {
  afterEach(function () {
    sinon.restore();
  });

  describe("isAuthorized", function () {
    it("returns true for a configured admin", function () {
      sinon.stub(config, "redemptionAdmins").value(["Uadmin"]);
      expect(rewardAdmin.isAuthorized("Uadmin")).to.equal(true);
    });

    it("returns false for a non-admin", function () {
      sinon.stub(config, "redemptionAdmins").value(["Uadmin"]);
      expect(rewardAdmin.isAuthorized("Uother")).to.equal(false);
    });
  });

  describe("validateReward", function () {
    it("returns ok: true on the happy path", function () {
      const result = rewardAdmin.validateReward(validInput());
      expect(result).to.deep.equal({ ok: true });
    });

    it("fails when name is empty", function () {
      const result = rewardAdmin.validateReward(validInput({ name: "" }));
      expect(result.ok).to.equal(false);
      expect(result.errors).to.have.property("name");
    });

    it("fails when name is missing", function () {
      const result = rewardAdmin.validateReward(
        validInput({ name: undefined }),
      );
      expect(result.ok).to.equal(false);
      expect(result.errors).to.have.property("name");
    });

    it("fails when description is empty", function () {
      const result = rewardAdmin.validateReward(
        validInput({ description: "   " }),
      );
      expect(result.ok).to.equal(false);
      expect(result.errors).to.have.property("description");
    });

    it("fails when cost is negative", function () {
      const result = rewardAdmin.validateReward(validInput({ cost: -1 }));
      expect(result.ok).to.equal(false);
      expect(result.errors).to.have.property("cost");
    });

    it("fails when cost is not an integer", function () {
      const result = rewardAdmin.validateReward(validInput({ cost: 1.5 }));
      expect(result.ok).to.equal(false);
      expect(result.errors).to.have.property("cost");
    });

    it("fails when cost is NaN", function () {
      const result = rewardAdmin.validateReward(validInput({ cost: NaN }));
      expect(result.ok).to.equal(false);
      expect(result.errors).to.have.property("cost");
    });

    it("fails when imageURL is empty", function () {
      const result = rewardAdmin.validateReward(validInput({ imageURL: "" }));
      expect(result.ok).to.equal(false);
      expect(result.errors).to.have.property("imageURL");
    });
  });

  describe("listRewards", function () {
    it("calls find({}).sort({ sortOrder: 1, name: 1 }).toArray()", async function () {
      const rewards = [{ name: "A" }];
      const { find, sort, toArray } = stubFindSortToArray(rewards);

      const result = await rewardAdmin.listRewards();

      expect(find.calledWith({})).to.equal(true);
      expect(sort.calledWith({ sortOrder: 1, name: 1 })).to.equal(true);
      expect(toArray.calledOnce).to.equal(true);
      expect(result).to.deep.equal(rewards);
    });
  });

  describe("createReward", function () {
    it("inserts a document with active: true, createdBy/updatedBy set to the actor, and no kind field", async function () {
      stubFindSortLimitToArray([{ sortOrder: 4 }]);
      const insertOne = sinon.stub(rewardCollection, "insertOne").resolves({});
      sinon.useFakeTimers(new Date(2025, 0, 1));

      await rewardAdmin.createReward(validInput(), "Uadmin");

      const doc = insertOne.firstCall.args[0];
      expect(doc.active).to.equal(true);
      expect(doc.createdBy).to.equal("Uadmin");
      expect(doc.updatedBy).to.equal("Uadmin");
      expect(doc.createdAt).to.deep.equal(new Date(2025, 0, 1));
      expect(doc.updatedAt).to.deep.equal(new Date(2025, 0, 1));
      expect(doc).to.not.have.property("kind");
    });

    it("auto-assigns sortOrder one higher than the current max", async function () {
      stubFindSortLimitToArray([{ sortOrder: 9 }]);
      const insertOne = sinon.stub(rewardCollection, "insertOne").resolves({});

      await rewardAdmin.createReward(validInput(), "Uadmin");

      expect(insertOne.firstCall.args[0].sortOrder).to.equal(10);
    });

    it("assigns sortOrder 0 when the collection is empty", async function () {
      stubFindSortLimitToArray([]);
      const insertOne = sinon.stub(rewardCollection, "insertOne").resolves({});

      await rewardAdmin.createReward(validInput(), "Uadmin");

      expect(insertOne.firstCall.args[0].sortOrder).to.equal(0);
    });

    it("throws a GratitudeError when validation fails", async function () {
      const insertOne = sinon.stub(rewardCollection, "insertOne").resolves({});

      let caught;
      try {
        await rewardAdmin.createReward(validInput({ name: "" }), "Uadmin");
      } catch (e) {
        caught = e;
      }

      expect(caught).to.be.instanceof(GratitudeError);
      expect(caught.gratitudeErrors).to.have.property("name");
      expect(insertOne.called).to.equal(false);
    });

    it("respects active: false when passed explicitly", async function () {
      stubFindSortLimitToArray([]);
      const insertOne = sinon.stub(rewardCollection, "insertOne").resolves({});
      await rewardAdmin.createReward(validInput({ active: false }), "Uadmin");
      expect(insertOne.firstCall.args[0].active).to.equal(false);
    });
  });

  describe("updateReward", function () {
    it("calls updateOne with $set of editable fields + updatedBy/updatedAt only", async function () {
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});
      sinon.useFakeTimers(new Date(2025, 0, 2));
      const id = new ObjectId().toString();

      await rewardAdmin.updateReward(id, validInput(), "Uadmin");

      expect(updateOne.calledOnce).to.equal(true);
      const [filter, update] = updateOne.firstCall.args;
      expect(String(filter._id)).to.equal(id);
      expect(update.$set).to.have.property("name", "Sticker Pack");
      expect(update.$set).to.have.property("cost", 10);
      expect(update.$set).to.have.property("imageURL");
      expect(update.$set).to.have.property("active", true);
      expect(update.$set).to.not.have.property("sortOrder");
      expect(update.$set).to.have.property("updatedBy", "Uadmin");
      expect(update.$set.updatedAt).to.deep.equal(new Date(2025, 0, 2));
      expect(update.$set).to.not.have.property("kind");
      expect(update.$set).to.not.have.property("createdBy");
      expect(update.$set).to.not.have.property("createdAt");
    });

    it("throws a GratitudeError when validation fails", async function () {
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});
      const id = new ObjectId().toString();

      let caught;
      try {
        await rewardAdmin.updateReward(id, validInput({ cost: -5 }), "Uadmin");
      } catch (e) {
        caught = e;
      }

      expect(caught).to.be.instanceof(GratitudeError);
      expect(caught.gratitudeErrors).to.have.property("cost");
      expect(updateOne.called).to.equal(false);
    });
  });

  describe("moveReward", function () {
    function buildRewardList() {
      return [
        { _id: new ObjectId(), name: "Alpha", sortOrder: 0 },
        { _id: new ObjectId(), name: "Beta", sortOrder: 1 },
        { _id: new ObjectId(), name: "Gamma", sortOrder: 2 },
      ];
    }

    it("swaps sortOrder with the previous row when moving up", async function () {
      const rewards = buildRewardList();
      stubFindSortToArray(rewards);
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});
      sinon.useFakeTimers(new Date(2025, 1, 1));

      await rewardAdmin.moveReward(String(rewards[1]._id), "up", "Uadmin");

      expect(updateOne.callCount).to.equal(2);
      const firstCallSet = updateOne.firstCall.args[1].$set;
      const secondCallSet = updateOne.secondCall.args[1].$set;
      expect(updateOne.firstCall.args[0]._id).to.equal(rewards[1]._id);
      expect(firstCallSet.sortOrder).to.equal(0);
      expect(firstCallSet.updatedBy).to.equal("Uadmin");
      expect(updateOne.secondCall.args[0]._id).to.equal(rewards[0]._id);
      expect(secondCallSet.sortOrder).to.equal(1);
    });

    it("swaps sortOrder with the next row when moving down", async function () {
      const rewards = buildRewardList();
      stubFindSortToArray(rewards);
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});

      await rewardAdmin.moveReward(String(rewards[1]._id), "down", "Uadmin");

      expect(updateOne.callCount).to.equal(2);
      expect(updateOne.firstCall.args[0]._id).to.equal(rewards[1]._id);
      expect(updateOne.firstCall.args[1].$set.sortOrder).to.equal(2);
      expect(updateOne.secondCall.args[0]._id).to.equal(rewards[2]._id);
      expect(updateOne.secondCall.args[1].$set.sortOrder).to.equal(1);
    });

    it("is a no-op when moving the first row up", async function () {
      const rewards = buildRewardList();
      stubFindSortToArray(rewards);
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});

      await rewardAdmin.moveReward(String(rewards[0]._id), "up", "Uadmin");

      expect(updateOne.called).to.equal(false);
    });

    it("is a no-op when moving the last row down", async function () {
      const rewards = buildRewardList();
      stubFindSortToArray(rewards);
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});

      await rewardAdmin.moveReward(String(rewards[2]._id), "down", "Uadmin");

      expect(updateOne.called).to.equal(false);
    });

    it("is a no-op when the target reward is not found", async function () {
      stubFindSortToArray(buildRewardList());
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});

      await rewardAdmin.moveReward(new ObjectId().toString(), "up", "Uadmin");

      expect(updateOne.called).to.equal(false);
    });

    it("swaps with the next visible neighbor when filter hides items in between", async function () {
      const rewards = [
        { _id: new ObjectId(), name: "Alpha", sortOrder: 0, active: true },
        { _id: new ObjectId(), name: "Beta", sortOrder: 1, active: false },
        { _id: new ObjectId(), name: "Gamma", sortOrder: 2, active: true },
      ];
      stubFindSortToArray(rewards);
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});

      await rewardAdmin.moveReward(
        String(rewards[0]._id),
        "down",
        "Uadmin",
        "active",
      );

      expect(updateOne.callCount).to.equal(2);
      expect(updateOne.firstCall.args[0]._id).to.equal(rewards[0]._id);
      expect(updateOne.firstCall.args[1].$set.sortOrder).to.equal(2);
      expect(updateOne.secondCall.args[0]._id).to.equal(rewards[2]._id);
      expect(updateOne.secondCall.args[1].$set.sortOrder).to.equal(0);
    });

    it("is a no-op when the target is at the edge of the filtered view", async function () {
      const rewards = [
        { _id: new ObjectId(), name: "Alpha", sortOrder: 0, active: true },
        { _id: new ObjectId(), name: "Beta", sortOrder: 1, active: false },
      ];
      stubFindSortToArray(rewards);
      const updateOne = sinon.stub(rewardCollection, "updateOne").resolves({});

      await rewardAdmin.moveReward(
        String(rewards[0]._id),
        "down",
        "Uadmin",
        "active",
      );

      expect(updateOne.called).to.equal(false);
    });
  });

  describe("parseMainMetadata", function () {
    it("returns the stored filter when valid", function () {
      const raw = JSON.stringify({ filter: "inactive" });
      expect(rewardAdmin.parseMainMetadata(raw)).to.deep.equal({
        filter: "inactive",
      });
    });

    it("defaults to active when raw is empty or unparseable", function () {
      expect(rewardAdmin.parseMainMetadata("")).to.deep.equal({
        filter: "active",
      });
      expect(rewardAdmin.parseMainMetadata("not-json")).to.deep.equal({
        filter: "active",
      });
    });

    it("defaults to active when the filter value is unknown", function () {
      const raw = JSON.stringify({ filter: "bogus" });
      expect(rewardAdmin.parseMainMetadata(raw)).to.deep.equal({
        filter: "active",
      });
    });
  });

  describe("parseEditMetadata", function () {
    it("returns filter and rewardId when both are set", function () {
      const raw = JSON.stringify({ filter: "all", rewardId: "REWARDID" });
      expect(rewardAdmin.parseEditMetadata(raw)).to.deep.equal({
        filter: "all",
        rewardId: "REWARDID",
      });
    });

    it("returns defaults when raw is unparseable", function () {
      expect(rewardAdmin.parseEditMetadata("garbage")).to.deep.equal({
        filter: "active",
        rewardId: null,
      });
    });
  });

  describe("buildMainView", function () {
    it("returns a modal with a filter select and the Add button at the top, defaulting to active filter", function () {
      const view = rewardAdmin.buildMainView([]);
      expect(view.type).to.equal("modal");
      expect(view.callback_id).to.equal("reward_admin_main");
      expect(view.title.text).to.equal("Manage Rewards");

      const firstBlock = view.blocks[0];
      expect(firstBlock.type).to.equal("actions");
      expect(firstBlock.elements[0].type).to.equal("static_select");
      expect(firstBlock.elements[0].action_id).to.equal("reward_admin_filter");
      expect(firstBlock.elements[0].initial_option.value).to.equal("active");
      expect(firstBlock.elements[0].options.map((o) => o.value)).to.deep.equal([
        "active",
        "inactive",
        "all",
      ]);
      expect(firstBlock.elements[1].action_id).to.equal("reward_admin_add");
      expect(firstBlock.elements[1].text.text).to.equal("Add new reward");

      const metadata = JSON.parse(view.private_metadata);
      expect(metadata.filter).to.equal("active");
    });

    it("shows active rewards by default, hiding inactive ones", function () {
      const id1 = new ObjectId();
      const id2 = new ObjectId();
      const rewards = [
        {
          _id: id1,
          name: "Alpha",
          cost: 5,
          sortOrder: 0,
          active: true,
          imageURL: "https://example.com/alpha.png",
        },
        {
          _id: id2,
          name: "Beta",
          cost: 10,
          sortOrder: 1,
          active: false,
          imageURL: "https://example.com/beta.png",
        },
      ];

      const view = rewardAdmin.buildMainView(rewards);
      const sections = view.blocks.filter((b) => b.type === "section");
      expect(sections).to.have.length(1);
      expect(sections[0].text.text).to.include("*Alpha*");
      expect(sections[0].text.text).to.not.include("(inactive)");
      expect(sections[0].accessory.image_url).to.equal(
        "https://example.com/alpha.png",
      );
      expect(sections[0].accessory.alt_text).to.equal("Image of Alpha");

      const editButtons = view.blocks
        .filter((b) => b.type === "actions")
        .flatMap((b) => b.elements)
        .filter((e) => e.action_id === "reward_admin_edit");
      expect(editButtons).to.have.length(1);
      expect(editButtons[0].value).to.equal(String(id1));
    });

    it("shows only inactive rewards when filter=inactive", function () {
      const id1 = new ObjectId();
      const id2 = new ObjectId();
      const rewards = [
        { _id: id1, name: "Alpha", cost: 5, sortOrder: 0, active: true },
        { _id: id2, name: "Beta", cost: 10, sortOrder: 1, active: false },
      ];

      const view = rewardAdmin.buildMainView(rewards, "inactive");
      const sections = view.blocks.filter((b) => b.type === "section");
      expect(sections).to.have.length(1);
      expect(sections[0].text.text).to.include("*Beta*");
      expect(sections[0].text.text).to.include("(inactive)");

      const metadata = JSON.parse(view.private_metadata);
      expect(metadata.filter).to.equal("inactive");
      expect(view.blocks[0].elements[0].initial_option.value).to.equal(
        "inactive",
      );
    });

    it("shows all rewards when filter=all", function () {
      const id1 = new ObjectId();
      const id2 = new ObjectId();
      const rewards = [
        { _id: id1, name: "Alpha", cost: 5, sortOrder: 0, active: true },
        { _id: id2, name: "Beta", cost: 10, sortOrder: 1, active: false },
      ];

      const view = rewardAdmin.buildMainView(rewards, "all");
      const sections = view.blocks.filter((b) => b.type === "section");
      expect(sections).to.have.length(2);
    });

    it("renders an empty-state message appropriate to the active filter", function () {
      const view = rewardAdmin.buildMainView([], "active");
      const sections = view.blocks.filter((b) => b.type === "section");
      expect(sections).to.have.length(1);
      expect(sections[0].text.text).to.include("No active rewards");
    });

    it("renders an empty-state message appropriate to the inactive filter", function () {
      const view = rewardAdmin.buildMainView([], "inactive");
      const sections = view.blocks.filter((b) => b.type === "section");
      expect(sections).to.have.length(1);
      expect(sections[0].text.text).to.include("No inactive rewards");
    });

    it("renders Move up, Move down, and Edit buttons on every row", function () {
      const ids = [new ObjectId(), new ObjectId(), new ObjectId()];
      const rewards = ids.map((id, i) => ({
        _id: id,
        name: `R${i}`,
        cost: i,
        sortOrder: i,
        active: true,
      }));

      const view = rewardAdmin.buildMainView(rewards);
      const rowActionBlocks = view.blocks
        .filter((b) => b.type === "actions")
        .slice(1); // drop the top-level Add block

      const actionIdsForRow = (idx) =>
        rowActionBlocks[idx].elements.map((e) => e.action_id);

      const expected = [
        "reward_admin_moveup",
        "reward_admin_movedown",
        "reward_admin_edit",
      ];
      expect(actionIdsForRow(0)).to.deep.equal(expected);
      expect(actionIdsForRow(1)).to.deep.equal(expected);
      expect(actionIdsForRow(2)).to.deep.equal(expected);

      const middleUp = rowActionBlocks[1].elements.find(
        (e) => e.action_id === "reward_admin_moveup",
      );
      expect(middleUp.value).to.equal(String(ids[1]));
    });

    it("omits the image accessory when a reward has no imageURL", function () {
      const id = new ObjectId();
      const view = rewardAdmin.buildMainView([
        { _id: id, name: "NoImg", cost: 1, sortOrder: 0, active: true },
      ]);
      const section = view.blocks.find(
        (b) => b.type === "section" && b.text.text.includes("*NoImg*"),
      );
      expect(section.accessory).to.equal(undefined);
    });

    it("includes the description in the row text when set", function () {
      const id = new ObjectId();
      const view = rewardAdmin.buildMainView([
        {
          _id: id,
          name: "Widget",
          description: "A handy widget",
          cost: 5,
          sortOrder: 0,
          active: true,
        },
      ]);
      const section = view.blocks.find(
        (b) => b.type === "section" && b.text.text.includes("*Widget*"),
      );
      expect(section.text.text).to.include("A handy widget");
    });
  });

  describe("buildAddView", function () {
    it("returns a modal with expected block IDs and a submit button", function () {
      const view = rewardAdmin.buildAddView();
      expect(view.type).to.equal("modal");
      expect(view.callback_id).to.equal("reward_admin_add_submit");
      expect(view.submit.text).to.equal("Save");

      const blockIds = view.blocks
        .filter((b) => b.type === "input")
        .map((b) => b.block_id);
      expect(blockIds).to.include.members([
        "name",
        "description",
        "cost",
        "imageURL",
        "active",
      ]);
      expect(blockIds).to.not.include("sortOrder");
    });
  });

  describe("buildEditView", function () {
    it("pre-populates initial_value and stores _id in private_metadata", function () {
      const id = new ObjectId();
      const reward = {
        _id: id,
        name: "Gadget",
        description: "A handy gadget",
        cost: 50,
        sortOrder: 3,
        imageURL: "https://example.com/gadget.png",
        active: false,
      };

      const view = rewardAdmin.buildEditView(reward, "inactive");
      expect(view.type).to.equal("modal");
      expect(view.callback_id).to.equal("reward_admin_edit_submit");
      const metadata = JSON.parse(view.private_metadata);
      expect(metadata.rewardId).to.equal(String(id));
      expect(metadata.filter).to.equal("inactive");

      const byBlockId = {};
      for (const b of view.blocks) {
        if (b.block_id) byBlockId[b.block_id] = b;
      }
      expect(byBlockId.name.element.initial_value).to.equal("Gadget");
      expect(byBlockId.description.element.initial_value).to.equal(
        "A handy gadget",
      );
      expect(byBlockId.cost.element.initial_value).to.equal("50");
      expect(byBlockId.imageURL.element.initial_value).to.equal(
        "https://example.com/gadget.png",
      );
      expect(byBlockId.active.element.initial_options).to.equal(undefined);
      expect(byBlockId).to.not.have.property("sortOrder");
    });
  });

  describe("parseViewSubmission", function () {
    function buildView(overrides) {
      return {
        state: {
          values: Object.assign(
            {
              name: { name_action: { value: "Widget" } },
              description: { description_action: { value: "A widget" } },
              cost: { cost_action: { value: "15" } },
              imageURL: {
                imageURL_action: { value: "https://example.com/w.png" },
              },
              active: {
                active_action: {
                  selected_options: [{ value: "active" }],
                },
              },
            },
            overrides || {},
          ),
        },
      };
    }

    it("extracts all fields and coerces cost to an integer", function () {
      const parsed = rewardAdmin.parseViewSubmission(buildView());
      expect(parsed).to.deep.equal({
        name: "Widget",
        description: "A widget",
        cost: 15,
        imageURL: "https://example.com/w.png",
        active: true,
      });
    });

    it("returns NaN when cost is not a number", function () {
      const parsed = rewardAdmin.parseViewSubmission(
        buildView({ cost: { cost_action: { value: "abc" } } }),
      );
      expect(Number.isNaN(parsed.cost)).to.equal(true);
    });

    it("maps the active checkbox to false when no option is selected", function () {
      const parsed = rewardAdmin.parseViewSubmission(
        buildView({
          active: { active_action: { selected_options: [] } },
        }),
      );
      expect(parsed.active).to.equal(false);
    });
  });
});
