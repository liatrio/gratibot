const winston = require("../winston");
const { directMention } = require("@slack/bolt");
const { anyOf, directMessage } = require("../middleware");
const rewardAdmin = require("../service/rewardAdmin");
const { GratitudeError } = require("../service/errors");

const NOT_AUTHORIZED_MESSAGE = "You are not authorized to manage rewards.";
const NO_ADMIN_ACCESS_MESSAGE = "You do not have admin access.";
const ADMIN_MATCHER = /^\s*admin\s*$/i;

module.exports = function (app) {
  app.message(
    ADMIN_MATCHER,
    anyOf(directMention, directMessage()),
    handleAdmin,
  );
  app.action("reward_admin_open", handleOpenAction);
  app.action("reward_admin_add", handleAddAction);
  app.action("reward_admin_edit", handleEditAction);
  app.view("reward_admin_add_submit", handleAddSubmit);
  app.view("reward_admin_edit_submit", handleEditSubmit);
};

// Collects the admin-control buttons the given user is permitted to see.
// Future admin capabilities should append their own entry here gated by
// the relevant authorization check.
function adminButtonsFor(userId) {
  const buttons = [];
  if (rewardAdmin.isAuthorized(userId)) {
    buttons.push({
      type: "button",
      style: "primary",
      text: { type: "plain_text", text: "Manage Rewards" },
      action_id: "reward_admin_open",
    });
  }
  return buttons;
}

async function handleAdmin({ message, say }) {
  winston.info("@gratibot admin Called", {
    func: "feature.rewardAdmin.handleAdmin",
    callingUser: message.user,
  });

  const buttons = adminButtonsFor(message.user);
  if (buttons.length === 0) {
    await say(NO_ADMIN_ACCESS_MESSAGE);
    return;
  }

  // Message events do not carry a trigger_id, so a modal cannot be opened
  // directly from the "admin" message. Reply with buttons; the subsequent
  // action click supplies the trigger_id used to open the modal.
  await say({
    text: "Admin controls",
    blocks: [{ type: "actions", elements: buttons }],
  });
}

async function handleOpenAction({ ack, body, client, respond }) {
  await ack();
  if (!rewardAdmin.isAuthorized(body.user.id)) {
    winston.warn("non-admin attempted reward_admin_open", {
      func: "feature.rewardAdmin.handleOpenAction",
      callingUser: body.user.id,
    });
    await respond({
      response_type: "ephemeral",
      replace_original: false,
      text: NOT_AUTHORIZED_MESSAGE,
    });
    return;
  }

  const rewards = await rewardAdmin.listRewards();
  await client.views.open({
    trigger_id: body.trigger_id,
    view: rewardAdmin.buildMainView(rewards),
  });
}

async function handleAddAction({ ack, body, client }) {
  await ack();
  if (!rewardAdmin.isAuthorized(body.user.id)) {
    winston.warn("non-admin attempted reward_admin_add", {
      func: "feature.rewardAdmin.handleAddAction",
      callingUser: body.user.id,
    });
    return;
  }

  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: rewardAdmin.buildAddView(),
  });
}

async function handleEditAction({ ack, body, client }) {
  await ack();
  if (!rewardAdmin.isAuthorized(body.user.id)) {
    winston.warn("non-admin attempted reward_admin_edit", {
      func: "feature.rewardAdmin.handleEditAction",
      callingUser: body.user.id,
    });
    return;
  }

  const rewardId = body.actions[0].value;
  const rewards = await rewardAdmin.listRewards();
  const reward = rewards.find((r) => String(r._id) === rewardId);
  if (!reward) {
    winston.warn("reward_admin_edit target not found", {
      func: "feature.rewardAdmin.handleEditAction",
      rewardId,
    });
    return;
  }

  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: rewardAdmin.buildEditView(reward),
  });
}

async function handleAddSubmit({ ack, body, view }) {
  if (!rewardAdmin.isAuthorized(body.user.id)) {
    winston.warn("non-admin view_submission on reward_admin_add_submit", {
      func: "feature.rewardAdmin.handleAddSubmit",
      callingUser: body.user.id,
    });
    await ack({
      response_action: "errors",
      errors: { name: "Not authorized." },
    });
    return;
  }

  try {
    const input = rewardAdmin.parseViewSubmission(view);
    const validation = rewardAdmin.validateReward(input);
    if (!validation.ok) {
      await ack({ response_action: "errors", errors: validation.errors });
      return;
    }

    await rewardAdmin.createReward(input, body.user.id);
    const rewards = await rewardAdmin.listRewards();
    await ack({
      response_action: "update",
      view: rewardAdmin.buildMainView(rewards),
    });
  } catch (error) {
    winston.error("reward_admin_add_submit failed", {
      func: "feature.rewardAdmin.handleAddSubmit",
      callingUser: body.user.id,
      error: error.message,
    });
    if (error instanceof GratitudeError) {
      await ack({
        response_action: "errors",
        errors: error.gratitudeErrors,
      });
      return;
    }
    await ack({
      response_action: "errors",
      errors: { name: "Something went wrong. Please try again." },
    });
  }
}

async function handleEditSubmit({ ack, body, view }) {
  if (!rewardAdmin.isAuthorized(body.user.id)) {
    winston.warn("non-admin view_submission on reward_admin_edit_submit", {
      func: "feature.rewardAdmin.handleEditSubmit",
      callingUser: body.user.id,
    });
    await ack({
      response_action: "errors",
      errors: { name: "Not authorized." },
    });
    return;
  }

  try {
    const input = rewardAdmin.parseViewSubmission(view);
    const validation = rewardAdmin.validateReward(input);
    if (!validation.ok) {
      await ack({ response_action: "errors", errors: validation.errors });
      return;
    }

    const rewardId = view.private_metadata;
    await rewardAdmin.updateReward(rewardId, input, body.user.id);
    const rewards = await rewardAdmin.listRewards();
    await ack({
      response_action: "update",
      view: rewardAdmin.buildMainView(rewards),
    });
  } catch (error) {
    winston.error("reward_admin_edit_submit failed", {
      func: "feature.rewardAdmin.handleEditSubmit",
      callingUser: body.user.id,
      error: error.message,
    });
    if (error instanceof GratitudeError) {
      await ack({
        response_action: "errors",
        errors: error.gratitudeErrors,
      });
      return;
    }
    await ack({
      response_action: "errors",
      errors: { name: "Something went wrong. Please try again." },
    });
  }
}
