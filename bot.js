//  __   __  ___        ___
// |__) /  \  |  |__/ |  |
// |__) \__/  |  |  \ |  |

const { Botkit } = require("botkit");
const {
  SlackAdapter,
  SlackMessageTypeMiddleware,
  SlackEventMiddleware,
} = require("botbuilder-adapter-slack");

require("dotenv").config();

const adapter = new SlackAdapter({
  clientSigningSecret: process.env.SIGNING_SECRET,
  botToken: process.env.BOT_USER_OAUTH_ACCESS_TOKEN,
});

adapter.use(new SlackEventMiddleware());
adapter.use(new SlackMessageTypeMiddleware());

const controller = new Botkit({
  webhook_uri: "/api/messages",
  adapter: adapter,
});

controller.ready(() => {
  controller.loadModules(__dirname + "/features");
});

controller.webserver.get("/", (req, res) => {
  res.send(`This app is running Botkit ${controller.version}.`);
});
