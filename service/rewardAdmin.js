const { ObjectId } = require("mongodb");
const rewardCollection = require("../database/rewardCollection");
const config = require("../config");
const winston = require("../winston");
const { GratitudeError } = require("./errors");

const EDITABLE_FIELDS = [
  "name",
  "description",
  "cost",
  "imageURL",
  "sortOrder",
  "active",
];

function isAuthorized(userId) {
  return config.redemptionAdmins.includes(userId);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isInteger(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value)
  );
}

function validateReward(input) {
  const errors = {};

  if (!isNonEmptyString(input.name)) {
    errors.name = "Name is required.";
  }
  if (!isNonEmptyString(input.description)) {
    errors.description = "Description is required.";
  }
  if (!isInteger(input.cost) || input.cost < 0) {
    errors.cost = "Cost must be a non-negative integer.";
  }
  if (!isInteger(input.sortOrder)) {
    errors.sortOrder = "Sort order must be an integer.";
  }
  if (!isNonEmptyString(input.imageURL)) {
    errors.imageURL = "Image URL is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

async function listRewards() {
  winston.debug("listing rewards", { func: "service.rewardAdmin.listRewards" });
  return rewardCollection.find({}).sort({ sortOrder: 1, name: 1 }).toArray();
}

async function createReward(input, actorUserId) {
  const validation = validateReward(input);
  if (!validation.ok) {
    throw new GratitudeError(validation.errors, "Reward validation failed");
  }

  const now = new Date();
  const doc = {
    name: input.name,
    description: input.description,
    cost: input.cost,
    imageURL: input.imageURL,
    sortOrder: input.sortOrder,
    active: input.active !== false,
    createdBy: actorUserId,
    updatedBy: actorUserId,
    createdAt: now,
    updatedAt: now,
  };

  winston.info("creating reward", {
    func: "service.rewardAdmin.createReward",
    callingUser: actorUserId,
    rewardName: doc.name,
  });

  return rewardCollection.insertOne(doc);
}

async function updateReward(id, input, actorUserId) {
  const validation = validateReward(input);
  if (!validation.ok) {
    throw new GratitudeError(validation.errors, "Reward validation failed");
  }

  const now = new Date();
  const set = { updatedBy: actorUserId, updatedAt: now };
  for (const field of EDITABLE_FIELDS) {
    if (input[field] !== undefined) {
      set[field] = input[field];
    }
  }

  winston.info("updating reward", {
    func: "service.rewardAdmin.updateReward",
    callingUser: actorUserId,
    rewardId: id,
  });

  return rewardCollection.updateOne({ _id: new ObjectId(id) }, { $set: set });
}

function buildMainView(rewards) {
  const blocks = [
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Add new reward" },
          action_id: "reward_admin_add",
        },
      ],
    },
    { type: "divider" },
  ];

  if (rewards.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "_No rewards exist yet._" },
    });
  } else {
    for (const reward of rewards) {
      const inactiveSuffix = reward.active === false ? "  _(inactive)_" : "";
      const section = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${reward.name}*${inactiveSuffix}\nCost: ${reward.cost}  •  Sort order: ${reward.sortOrder}`,
        },
      };
      if (reward.imageURL) {
        section.accessory = {
          type: "image",
          image_url: reward.imageURL,
          alt_text: `Image of ${reward.name}`,
        };
      }
      blocks.push(section);
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Edit" },
            action_id: "reward_admin_edit",
            value: String(reward._id),
          },
        ],
      });
    }
  }

  return {
    type: "modal",
    callback_id: "reward_admin_main",
    title: { type: "plain_text", text: "Manage Rewards" },
    close: { type: "plain_text", text: "Close" },
    blocks,
  };
}

function formInputBlocks(initial) {
  const values = initial || {};
  return [
    {
      type: "input",
      block_id: "name",
      label: { type: "plain_text", text: "Name" },
      element: {
        type: "plain_text_input",
        action_id: "name_action",
        initial_value:
          values.name !== undefined ? String(values.name) : undefined,
      },
    },
    {
      type: "input",
      block_id: "description",
      label: { type: "plain_text", text: "Description" },
      element: {
        type: "plain_text_input",
        action_id: "description_action",
        multiline: true,
        initial_value:
          values.description !== undefined
            ? String(values.description)
            : undefined,
      },
    },
    {
      type: "input",
      block_id: "cost",
      label: { type: "plain_text", text: "Cost (fistbumps)" },
      element: {
        type: "plain_text_input",
        action_id: "cost_action",
        initial_value:
          values.cost !== undefined ? String(values.cost) : undefined,
      },
    },
    {
      type: "input",
      block_id: "sortOrder",
      label: { type: "plain_text", text: "Sort order" },
      element: {
        type: "plain_text_input",
        action_id: "sortOrder_action",
        initial_value:
          values.sortOrder !== undefined ? String(values.sortOrder) : undefined,
      },
    },
    {
      type: "input",
      block_id: "imageURL",
      label: { type: "plain_text", text: "Image URL" },
      element: {
        type: "plain_text_input",
        action_id: "imageURL_action",
        initial_value:
          values.imageURL !== undefined ? String(values.imageURL) : undefined,
      },
    },
    {
      type: "input",
      block_id: "active",
      optional: true,
      label: { type: "plain_text", text: "Active" },
      element: {
        type: "checkboxes",
        action_id: "active_action",
        options: [
          {
            text: { type: "plain_text", text: "Show this reward to end users" },
            value: "active",
          },
        ],
        initial_options:
          values.active !== false
            ? [
                {
                  text: {
                    type: "plain_text",
                    text: "Show this reward to end users",
                  },
                  value: "active",
                },
              ]
            : undefined,
      },
    },
  ];
}

function stripUndefined(block) {
  if (Array.isArray(block)) {
    return block.map(stripUndefined);
  }
  if (block && typeof block === "object") {
    const out = {};
    for (const key of Object.keys(block)) {
      if (block[key] === undefined) continue;
      out[key] = stripUndefined(block[key]);
    }
    return out;
  }
  return block;
}

function buildAddView() {
  return {
    type: "modal",
    callback_id: "reward_admin_add_submit",
    title: { type: "plain_text", text: "Add Reward" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: stripUndefined(formInputBlocks({ active: true })),
  };
}

function buildEditView(reward) {
  return {
    type: "modal",
    callback_id: "reward_admin_edit_submit",
    private_metadata: String(reward._id),
    title: { type: "plain_text", text: "Edit Reward" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: stripUndefined(formInputBlocks(reward)),
  };
}

function parseViewSubmission(view) {
  const values = view.state && view.state.values ? view.state.values : {};

  function readInput(blockId, actionId) {
    const block = values[blockId];
    if (!block) return undefined;
    const el = block[actionId];
    if (!el) return undefined;
    return el.value;
  }

  const rawCost = readInput("cost", "cost_action");
  const rawSortOrder = readInput("sortOrder", "sortOrder_action");
  const activeBlock = values.active && values.active.active_action;
  const activeSelected =
    activeBlock &&
    Array.isArray(activeBlock.selected_options) &&
    activeBlock.selected_options.some((o) => o.value === "active");

  return {
    name: readInput("name", "name_action"),
    description: readInput("description", "description_action"),
    cost: toInteger(rawCost),
    sortOrder: toInteger(rawSortOrder),
    imageURL: readInput("imageURL", "imageURL_action"),
    active: !!activeSelected,
  };
}

function toInteger(raw) {
  if (raw === undefined || raw === null || raw === "") return NaN;
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  if (!Number.isInteger(n)) return NaN;
  return n;
}

module.exports = {
  isAuthorized,
  validateReward,
  listRewards,
  createReward,
  updateReward,
  buildMainView,
  buildAddView,
  buildEditView,
  parseViewSubmission,
};
