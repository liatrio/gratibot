const sinon = require("sinon");

const mockBot = (controller) => ({
  api: {
    chat: {
      postEphemeral: controller.message.bind(controller, "ephemeral"),
      postMessage: (message) => {
        if (message.thread_ts) {
          return controller.message.call(controller, "thread", message);
        }

        return controller.message.call(controller, "main", message);
      },
      update: (message) => {
        if (message.thread_ts) {
          return controller.update.call(controller, "thread", message);
        }

        return controller.update.call(controller, "main", message);
      },
    },
    conversations: {
      history: sinon.stub(),
    },
    reactions: {
      add: function (reaction) {
        return new Promise((resolve) => {
          this.reactions.push(reaction);

          resolve();
        });
      }.bind(controller),
    },
    users: {
      lookupByEmail: sinon.stub(),
      info: sinon.stub(),
    },
    channels: {
      info: (/* args */) => ({
        channel: {
          name: controller.info.channelName,
        },
      }),
    },
    files: {
      upload: (file) => {
        if (file.thread_ts) {
          return controller.file.call(controller, "thread", file);
        }

        return controller.file.call(controller, "main", file);
      },
    },
    auth: {
      test: sinon.stub(),
    },
    views: {},
  },
  reply: controller.reply.bind(controller, "channel"),
  replyEphemeral: controller.reply.bind(controller, "ephemeral"),
  replyInThread: controller.reply.bind(controller, "thread"),
  replyInteractive: controller.reply.bind(controller, "interactive"),
  replyAcknowledge: sinon.stub(),
  say: controller.reply.bind(controller, "thread", []),
  startPrivateConversation: sinon.stub(),
  startConversationInThread: sinon.stub(),
  startConversationInChannel: sinon.stub(),

  beginDialog: sinon.stub(),
  changeContext: sinon.stub(),
});

module.exports = mockBot;
