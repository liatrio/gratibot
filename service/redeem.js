const balance = require("../service/balance");
const config = require("../config")

const { redemptionAdmins } = config;

async function createRedeemBlocks(user) {
  let blocks = []

  // TODO: Long term this should be sourced from DB
  const gratibotRewards = [
    {
      name: "Test Item 1",
      description: "This test item is really really nice.",
      imageURL: "",
      cost: 10,
    },
    {
      name: "Test Item 2",
      description: "This test item is really really nice.",
      imageURL: "",
      cost: 100,
    },
    {
      name: "Test Item 3",
      description: "This test item is okay.",
      imageURL: "",
      cost: 50,
    },
  ];

  const currentBalance = await balance.currentBalance(user);

  blocks.push(redeemHeader());
  blocks.push(redeemHelpText(currentBalance));
  blocks.push(...redeemItems(gratibotRewards));
  blocks.push(redeemSelector(gratibotRewards))

  return blocks;
}

function redeemHeader() {
  return {
    "type": "header",
    "text": {
      "type": "plain_text",
      "text": "Gratibot Rewards",
    }
  }
}

function redeemHelpText(currentBalance) {
  return {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": `Take a look at the currently available rewards!\nBalance: ${currentBalance}`
    }
  }
}

function redeemItems(gratibotRewards) {
  let blocks = [];
  for (let i = 0; i < gratibotRewards.length; i++) {
    blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*${gratibotRewards[i].name}*\n${gratibotRewards[i].description}\nCost: ${gratibotRewards[i].cost}`
      },
      "accessory": {
        "type": "image",
        "image_url": `${gratibotRewards[i].imageUUL}`,
        "alt_text": `Image of ${gratibotRewards[i].name}`
      }
    });
  }
  return blocks
}

function redeemSelector(gratibotRewards) {
  options = [];
  for (let i = 0; i < gratibotRewards.length; i++) {
    const item = {
      name: `${gratibotRewards[i].name}`,
      cost: `${gratibotRewards[i].cost}`,
    }
    options.push({
      text: {
        type: "plain_text",
        text: `${gratibotRewards[i].name}`,
      },
      value: JSON.stringify(item),
    });
  }
  return {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "Pick an item from the dropdown list"
    },
    "accessory": {
      "type": "static_select",
      "placeholder": {
        "type": "plain_text",
        "text": "Select an item"
      },
      "options": options,
      "confirm": {
        "title": {
          "type": "plain_text",
          "text": "Are you sure?"
        },
        "text": {
          "type": "mrkdwn",
          "text": "You're sure you want to buy?"
        },
        "confirm": {
          "type": "plain_text",
          "text": "Yes"
        },
        "deny": {
          "type": "plain_text",
          "text": "Stop, I've changed my mind!"
        }
      },
      "action_id": "redeem"
    }
  }
}

function createMPIM(redeemingUser) {
  let mpimGroup = `${redeemingUser}`;
  for (let i = 0; i < redemptionAdmins.length; i++) {
    mpimGroup += `, ${redemptionAdmins[i]}`
  }
  return mpimGroup;
}

// Assumes value is json string  
function getSelectedItemDetails(selectedItem) {  
  const item = JSON.parse(selectedItem)  
  return {  
    "itemName": item.name,   
    "itemCost": item.cost,   
  }  
}

module.exports = {
  createRedeemBlocks,
  createMPIM,
  getSelectedItemDetails,
}
