const { expect } = require('chai');
const sinon = require('sinon');

const help = require('../../service/help');

describe('service/help', () => {
  let testClient;
  let message;
  let sayStub;

  beforeEach(() => {
    testClient = {
      chat: {
        postEphemeral: sinon.stub().resolves({}),
      },
    };
    message = {
      user: 'testUser',
      channel: 'testChannel',
      text: 'testText',
    };
    sayStub = sinon.stub().resolves({});
  });

  describe('respondToHelp', () => {
    it('should post help message to Slack', async () => {
      await help.respondToHelp({ message, client: testClient });
      expect(testClient.chat.postEphemeral.calledOnce).to.be.true;
      expect(testClient.chat.postEphemeral.getCall(0).args[0]).to.deep.equal({
        channel: message.channel,
        user: message.user,
        text: help.helpMarkdown,
      });
    });
  });

  describe('respondToEasterEgg', () => {
    it('should respond with thunderfury message to Slack', async () => {
      await help.respondToEasterEgg({ message, say: sayStub });
      expect(sayStub.calledOnce).to.be.true;
      expect(sayStub.getCall(0).args[0]).to.equal(help.thunderfuryResponse);
    });

    it('should not respond if the message is from a bot', async () => {
      const botMessage = { ...message, bot_id: 'someBotId' };
      await help.respondToEasterEgg({ message: botMessage, say: sayStub });
      expect(sayStub.called).to.be.false;
    });
  });
});
