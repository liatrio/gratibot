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
      sortOrder: 2,
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

    it("fails when sortOrder is not an integer", function () {
      const result = rewardAdmin.validateReward(validInput({ sortOrder: 1.5 }));
      expect(result.ok).to.equal(false);
      expect(result.errors).to.have.property("sortOrder");
    });

    it("accepts negative sortOrder", function () {
      const result = rewardAdmin.validateReward(validInput({ sortOrder: -3 }));
      expect(result.ok).to.equal(true);
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
      expect(update.$set).to.have.property("sortOrder", 2);
      expect(update.$set).to.have.property("active", true);
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

  describe("buildMainView", function () {
    it("returns a modal with the Add button at the top", function () {
      const view = rewardAdmin.buildMainView([]);
      expect(view.type).to.equal("modal");
      expect(view.callback_id).to.equal("reward_admin_main");
      expect(view.title.text).to.equal("Manage Rewards");

      const firstBlock = view.blocks[0];
      expect(firstBlock.type).to.equal("actions");
      expect(firstBlock.elements[0].action_id).to.equal("reward_admin_add");
      expect(firstBlock.elements[0].text.text).to.equal("Add new reward");
    });

    it("renders one section per reward with an image accessory and an Edit button carrying _id", function () {
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
      expect(sections).to.have.length(2);

      expect(sections[0].text.text).to.include("*Alpha*");
      expect(sections[0].text.text).to.not.include("(inactive)");
      expect(sections[0].accessory.type).to.equal("image");
      expect(sections[0].accessory.image_url).to.equal(
        "https://example.com/alpha.png",
      );
      expect(sections[0].accessory.alt_text).to.equal("Image of Alpha");

      expect(sections[1].text.text).to.include("*Beta*");
      expect(sections[1].text.text).to.include("(inactive)");
      expect(sections[1].accessory.image_url).to.equal(
        "https://example.com/beta.png",
      );

      const editButtons = view.blocks
        .filter((b) => b.type === "actions")
        .flatMap((b) => b.elements)
        .filter((e) => e.action_id === "reward_admin_edit");
      expect(editButtons).to.have.length(2);
      expect(editButtons[0].value).to.equal(String(id1));
      expect(editButtons[1].value).to.equal(String(id2));
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
        "sortOrder",
        "imageURL",
        "active",
      ]);
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

      const view = rewardAdmin.buildEditView(reward);
      expect(view.type).to.equal("modal");
      expect(view.callback_id).to.equal("reward_admin_edit_submit");
      expect(view.private_metadata).to.equal(String(id));

      const byBlockId = {};
      for (const b of view.blocks) {
        if (b.block_id) byBlockId[b.block_id] = b;
      }
      expect(byBlockId.name.element.initial_value).to.equal("Gadget");
      expect(byBlockId.description.element.initial_value).to.equal(
        "A handy gadget",
      );
      expect(byBlockId.cost.element.initial_value).to.equal("50");
      expect(byBlockId.sortOrder.element.initial_value).to.equal("3");
      expect(byBlockId.imageURL.element.initial_value).to.equal(
        "https://example.com/gadget.png",
      );
      expect(byBlockId.active.element.initial_options).to.equal(undefined);
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
              sortOrder: { sortOrder_action: { value: "2" } },
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

    it("extracts all fields and coerces cost/sortOrder to integers", function () {
      const parsed = rewardAdmin.parseViewSubmission(buildView());
      expect(parsed).to.deep.equal({
        name: "Widget",
        description: "A widget",
        cost: 15,
        sortOrder: 2,
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

    it("returns NaN when sortOrder is not an integer", function () {
      const parsed = rewardAdmin.parseViewSubmission(
        buildView({ sortOrder: { sortOrder_action: { value: "1.2" } } }),
      );
      expect(Number.isNaN(parsed.sortOrder)).to.equal(true);
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
