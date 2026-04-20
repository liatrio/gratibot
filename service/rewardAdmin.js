const { ObjectId } = require("mongodb");
const rewardCollection = require("../database/rewardCollection");
const config = require("../config");
const winston = require("../winston");
const { GratitudeError } = require("./errors");

const EDITABLE_FIELDS = ["name", "description", "cost", "imageURL", "active"];

const FILTERS = {
  active: "Active",
  inactive: "Inactive",
  all: "All",
};

function normalizeFilter(filter) {
  return Object.prototype.hasOwnProperty.call(FILTERS, filter)
    ? filter
    : "active";
}

function filterRewards(rewards, filter) {
  const f = normalizeFilter(filter);
  if (f === "inactive") return rewards.filter((r) => r.active === false);
  if (f === "all") return rewards;
  return rewards.filter((r) => r.active !== false);
}

function parseMetadata(raw) {
  const defaults = { filter: "active", rewardId: null };
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    return {
      filter: normalizeFilter(parsed.filter),
      rewardId: parsed.rewardId || null,
    };
  } catch {
    return defaults;
  }
}

function isAuthorized(userId) {
  return config.redemptionAdmins.includes(userId);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateReward(input) {
  const errors = {};

  if (!isNonEmptyString(input.name)) {
    errors.name = "Name is required.";
  }
  if (!isNonEmptyString(input.description)) {
    errors.description = "Description is required.";
  }
  if (!Number.isInteger(input.cost) || input.cost < 0) {
    errors.cost = "Cost must be a non-negative integer.";
  }
  if (!isNonEmptyString(input.imageURL)) {
    errors.imageURL = "Image URL is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

async function nextSortOrder() {
  const last = await rewardCollection
    .find({})
    .sort({ sortOrder: -1 })
    .limit(1)
    .toArray();
  if (last.length === 0) return 0;
  return (last[0].sortOrder ?? -1) + 1;
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
    sortOrder: await nextSortOrder(),
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

async function moveReward(id, direction, actorUserId, filter = "all") {
  if (direction !== "up" && direction !== "down") {
    throw new Error(`moveReward: invalid direction ${direction}`);
  }

  const rewards = await rewardCollection
    .find({})
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
  // Move within the filtered view so the user sees a neighbor swap that
  // matches what they clicked. Hidden rewards keep their sortOrder.
  const visible = filterRewards(rewards, filter);
  const targetIdx = visible.findIndex((r) => String(r._id) === String(id));
  if (targetIdx === -1) return;

  const neighborIdx = direction === "up" ? targetIdx - 1 : targetIdx + 1;
  if (neighborIdx < 0 || neighborIdx >= visible.length) return;

  const target = visible[targetIdx];
  const neighbor = visible[neighborIdx];
  const now = new Date();

  winston.info("moving reward", {
    func: "service.rewardAdmin.moveReward",
    callingUser: actorUserId,
    rewardId: String(target._id),
    direction,
  });

  await rewardCollection.updateOne(
    { _id: target._id },
    {
      $set: {
        sortOrder: neighbor.sortOrder,
        updatedBy: actorUserId,
        updatedAt: now,
      },
    },
  );
  await rewardCollection.updateOne(
    { _id: neighbor._id },
    {
      $set: {
        sortOrder: target.sortOrder,
        updatedBy: actorUserId,
        updatedAt: now,
      },
    },
  );
}

function filterSelectOption(filter) {
  return {
    text: { type: "plain_text", text: FILTERS[filter] },
    value: filter,
  };
}

function buildMainView(rewards, filter = "active") {
  const activeFilter = normalizeFilter(filter);
  const visibleRewards = filterRewards(rewards, activeFilter);
  const blocks = [
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "reward_admin_filter",
          placeholder: { type: "plain_text", text: "Filter" },
          initial_option: filterSelectOption(activeFilter),
          options: Object.keys(FILTERS).map(filterSelectOption),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Add new reward" },
          action_id: "reward_admin_add",
        },
      ],
    },
    { type: "divider" },
  ];

  if (visibleRewards.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          activeFilter === "inactive"
            ? "_No inactive rewards._"
            : activeFilter === "all"
              ? "_No rewards exist yet._"
              : "_No active rewards._",
      },
    });
  } else {
    visibleRewards.forEach((reward) => {
      const inactiveSuffix = reward.active === false ? "  _(inactive)_" : "";
      const descriptionLine = reward.description
        ? `\n${reward.description}`
        : "";
      const section = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${reward.name}*${inactiveSuffix}\nCost: ${reward.cost}${descriptionLine}`,
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

      // Slack Block Kit has no disabled-button state, so the move buttons
      // always render; moveReward no-ops at edges (see service.moveReward).
      const rowButtons = [
        {
          type: "button",
          text: { type: "plain_text", text: "↑ Move up" },
          action_id: "reward_admin_moveup",
          value: String(reward._id),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "↓ Move down" },
          action_id: "reward_admin_movedown",
          value: String(reward._id),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Edit" },
          action_id: "reward_admin_edit",
          value: String(reward._id),
        },
      ];
      blocks.push({ type: "actions", elements: rowButtons });
    });
  }

  return {
    type: "modal",
    callback_id: "reward_admin_main",
    private_metadata: JSON.stringify({ filter: activeFilter }),
    title: { type: "plain_text", text: "Manage Rewards" },
    close: { type: "plain_text", text: "Close" },
    blocks,
  };
}

function textInput(blockId, label, values, extra) {
  const initial =
    values[blockId] !== undefined
      ? { initial_value: String(values[blockId]) }
      : {};
  return {
    type: "input",
    block_id: blockId,
    label: { type: "plain_text", text: label },
    element: {
      type: "plain_text_input",
      action_id: `${blockId}_action`,
      ...(extra || {}),
      ...initial,
    },
  };
}

const ACTIVE_OPTION = {
  text: { type: "plain_text", text: "Show this reward to end users" },
  value: "active",
};

function formInputBlocks(initial) {
  const values = initial || {};
  return [
    textInput("name", "Name", values),
    textInput("description", "Description", values, { multiline: true }),
    textInput("cost", "Cost (fistbumps)", values),
    textInput("imageURL", "Image URL", values),
    {
      type: "input",
      block_id: "active",
      optional: true,
      label: { type: "plain_text", text: "Active" },
      element: {
        type: "checkboxes",
        action_id: "active_action",
        options: [ACTIVE_OPTION],
        ...(values.active !== false && { initial_options: [ACTIVE_OPTION] }),
      },
    },
  ];
}

function buildAddView(filter = "active") {
  return {
    type: "modal",
    callback_id: "reward_admin_add_submit",
    private_metadata: JSON.stringify({ filter: normalizeFilter(filter) }),
    title: { type: "plain_text", text: "Add Reward" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: formInputBlocks({ active: true }),
  };
}

function buildEditView(reward, filter = "active") {
  return {
    type: "modal",
    callback_id: "reward_admin_edit_submit",
    private_metadata: JSON.stringify({
      filter: normalizeFilter(filter),
      rewardId: String(reward._id),
    }),
    title: { type: "plain_text", text: "Edit Reward" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: formInputBlocks(reward),
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
  const activeBlock = values.active && values.active.active_action;
  const activeSelected =
    activeBlock &&
    Array.isArray(activeBlock.selected_options) &&
    activeBlock.selected_options.some((o) => o.value === "active");

  return {
    name: readInput("name", "name_action"),
    description: readInput("description", "description_action"),
    cost: toInteger(rawCost),
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
  moveReward,
  buildMainView,
  buildAddView,
  buildEditView,
  parseViewSubmission,
  parseMetadata,
};
