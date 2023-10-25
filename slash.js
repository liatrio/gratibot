const config = require("./config");
// const balance = require("./service/balance");
// const deduction = require("./service/deduction");
const help = require("./service/help");
// const join = require("./service/join");
// const leaderboard = require("./service/leaderboard");
// const metrics = require("./service/metrics");
// const recognition = require("./service/recognition");
// const redeem = require("./service/redeem");

const {
  // goldenRecognizeEmoji,
  // maximum,
  // reactionEmoji,
  // recognizeEmoji,
  slashCommand,
} = config;

function parseCommand(command) {
  const parsed = {
    valid: false, // indicates if a command is valid
    command: command.command, // holds the type of command
    channel: `<@${command.channel_id}>`, // holds the channel that the command was sent in
    user: `${command.user_name}`, // holds the value for the user that will be targeted
    text: command.text, // holds any additional text that is sent with the command
  };

  const raw = command.text.split(" "); // raw command as an array
  parsed.command = raw[0];

  switch (raw[0]) {
    case "help":
      parsed.valid = true; // command is valid, but doesn't require any additional info
      break;
  }

  return parsed;
}

module.exports = function (app) {
  app.command(slashCommand, async ({ command, ack, respond }) => {
    await ack();
    const userCommand = parseCommand(command);
    console.log("USER COMMAND");
    console.log(userCommand);

    switch (userCommand.command) {
      case "help":
        await respond(await help.respondToHelp(userCommand, app.client));
        break;
    }
  });
};
