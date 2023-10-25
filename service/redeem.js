const config = require("../config");
const fs = require("fs");

const path = require("path");
// TODO: Long term this should be sourced from DB
let rawdata = fs.readFileSync(path.resolve(__dirname, "../rewards.json"));
const gratibotRewards = JSON.parse(rawdata);

const { redemptionAdmins } = config;

function createRedeemBlocks(currentBalance) {
  let blocks = [];

  blocks.push(redeemHeader());
  blocks.push(redeemHelpText(currentBalance));
  blocks.push(...redeemItems(gratibotRewards));
  blocks.push(redeemSelector(gratibotRewards));

  return blocks;
}

function redeemHeader() {
  return {
    type: "header",
    text: {
      type: "plain_text",
      text: "Gratibot Rewards",
    },
  };
}

function redeemHelpText(currentBalance) {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `Take a look at the currently available rewards!\nBalance: ${currentBalance}`,
    },
  };
}

function redeemItems(gratibotRewards) {
  let blocks = [];
  for (let i = 0; i < gratibotRewards.length; i++) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${gratibotRewards[i].name}*\n${gratibotRewards[i].description}\nCost: ${gratibotRewards[i].cost}`,
      },
      accessory: {
        type: "image",
        image_url: `${gratibotRewards[i].imageURL}`,
        alt_text: `Image of ${gratibotRewards[i].name}`,
      },
    });
  }
  return blocks;
}

function redeemSelector(gratibotRewards) {
  let options = [];
  for (let i = 0; i < gratibotRewards.length; i++) {
    const item = {
      name: `${gratibotRewards[i].name}`,
      cot: `${gratibotRewards[i].cost}`,
    };
    options.push({
      text: {
        type: "plain_text",
        text: `${gratibotRewards[i].name}`,
      },
      value: JSON.stringify(item),
    });
  }
  return {
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
      options: options,
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
}

function redeemNotificationUsers(redeemingUser, admins = redemptionAdmins) {
  let mpimGroup = `${redeemingUser}`;
  for (let i = 0; i < admins.length; i++) {
    mpimGroup += `, ${admins[i]}`;
  }
  return mpimGroup;
}

// Assumes value is json string
function getSelectedItemDetails(selectedItem) {
  const item = JSON.parse(selectedItem);
  return {
    itemName: item.name,
    itemCost: item.cost,
  };
}

module.exports = {
  createRedeemBlocks,
  redeemNotificationUsers,
  getSelectedItemDetails,
  redeemHeader,
  redeemHelpText,
  redeemItems,
  redeemSelector,
};
