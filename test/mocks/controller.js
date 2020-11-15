const Chance = require("chance");
const sinon = require("sinon");

const mockBot = require("./bot");

class MockController {
  constructor(config) {
    this.chance = new Chance();

    this.config = config;
    this.behavior = [];
    this.replies = [];
    this.reactions = [];
    this.messages = [];
    this.files = [];
    this.info = {
      id: this.chance.word(),
      channel: this.chance.word(),
      channelName: this.chance.word(),
    };
    this.bot = mockBot(this);
    this.addPluginExtension = sinon.stub();
    this.plugins = {
      slack: {
        getUserInfo: sinon.stub(),
      },
      help: {},
      participants: {},
      storage: {},
      kubernetes: {},
    };
  }

  getConfig(prop) {
    return this.config[prop];
  }

  hears(pattern, type, cb) {
    if (!Array.isArray(pattern)) {
      pattern = [pattern];
    }
    this.behavior.push({
      pattern,
      type,
      cb,
    });
  }

  on(type, cb) {
    this.behavior.push({
      type,
      cb,
    });
  }

  botInfo() {
    return this.info;
  }

  spawn() {
    return this.bot;
  }

  async userInput(message) {
    let matches = [];

    const response = this.behavior.find((b) =>
      b.pattern.some((pattern) => {
        const match = message.text.match(pattern);

        if (match !== null) {
          matches = match;

          return true;
        }

        return false;
      })
    );

    if (response) {
      await response.cb(
        this.bot,
        this.formatMessage({
          ...message,
          matches,
        })
      );
    }
  }

  async interactiveMessage(message) {
    const matches = [];
    const response = this.behavior.find(
      (b) => b.type === "interactive_message"
    );

    if (response) {
      await response.cb(
        this.bot,
        this.formatInteractiveMessage({
          ...message,
          matches,
        })
      );
    }
  }

  async event(type, message) {
    const handler = this.behavior.find((b) => b.type === type);
    if (handler) {
      await handler.cb(this.bot, message);
    }
  }

  formatMessage(message) {
    return {
      ts: this.chance.word(),
      channel: this.botInfo().channel,
      ...message,
      incoming_message: {
        recipient: {
          id: this.botInfo().id,
        },
      },
    };
  }

  formatInteractiveMessage(message) {
    return {
      ts: this.chance.word(),
      channel: this.botInfo().channel,
      ...message,
    };
  }

  reply(type, message, response) {
    return new Promise((resolve) => {
      this.replies.push({
        message,
        response,
        type,
      });

      resolve();
    });
  }

  file(type, file) {
    return new Promise((resolve, reject) => {
      if (!file.channels) {
        return reject(
          new Error("attempted to upload a file without a channel")
        );
      }

      this.files.push({
        type,
        file: {
          content: file.content,
          channel: file.channels,
          title: file.title,
          name: file.filename,
          type: file.filetype,
        },
      });

      return resolve();
    });
  }

  message(type, message) {
    return new Promise((resolve, reject) => {
      if (!message.channel) {
        return reject(new Error("attempted to post message without a channel"));
      }

      const ts = this.chance.word();
      const cacheMessage = {
        ...message,
        ts,
      };

      this.messages.push({
        message: cacheMessage,
        type,
        updated: false,
      });

      return resolve(cacheMessage);
    });
  }

  update(type, message) {
    return new Promise((resolve, reject) => {
      if (!message.channel) {
        return reject(
          new Error("attempted to update message without a channel")
        );
      }

      const messageIndex = this.messages.findIndex(
        (m) => m.message.ts === message.ts && m.type === type
      );

      if (messageIndex === -1) {
        reject(new Error("cannot update message, not found"));
      }

      this.messages = [
        ...this.messages.slice(0, messageIndex),
        {
          ...this.messages[messageIndex],
          message: {
            ...this.messages[messageIndex].message,
            ...message,
          },
          type,
          updated: true,
        },
        ...this.messages.slice(messageIndex + 1),
      ];

      return resolve();
    });
  }

  getMessages() {
    return this.messages;
  }

  getFiles() {
    return this.files;
  }

  getReplies() {
    return this.replies;
  }

  getReactions() {
    return this.reactions;
  }

  addDialog(/* confirmation */) {
    // Do Nothing
  }
}

module.exports = MockController;
