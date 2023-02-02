const { expect } = require('chai');
const sinon = require('sinon');
const { directMessage, anyOf, reactionMatches } = require('../../middleware');

describe("middleware/index", () => {
    describe('directMessage', () => {
        it('should call next if message channel type is "im"', async () => {
            const next = sinon.spy();
            const message = { channel_type: 'im' };
            await directMessage()({ message, next });
            expect(next.calledOnce).to.be.true;
        });

        it('should not call next if message channel type is not "im"', async () => {
            const next = sinon.spy();
            const message = { channel_type: 'not_im' };
            await directMessage()({ message, next });
            expect(next.called).to.be.false;
        });
    });

    describe('anyOf', () => {
        it("should call next if any of the passed functions return true", async () => {
            let nextCalled = false;
            const input = {
                next: () => nextCalled = true
            };
            const func1 = async () => {};
            const func2 = async () => { input.next() };
            const anyOfFunc = anyOf(func1, func2);
            await anyOfFunc(input);
            expect(nextCalled).to.be.true;
        });

        it('should not call next if none of the passed functions return true', async () => {
            const next = sinon.spy();
            const input = { next };
            const func1 = sinon.stub().resolves(false);
            const func2 = sinon.stub().resolves(false);
            await anyOf(func1, func2)(input);
            expect(next.called).to.be.false;
        });
    });

    describe("reactionMatches", () => {
        it("should only trigger the next middleware if the reaction matches the emoji", async () => {
          const event = { reaction: ":emoji:" };
          const next = sinon.spy();
          const reactionMatchesMiddleware = reactionMatches(":emoji:");
          await reactionMatchesMiddleware({ event, next });
          expect(next.calledOnce).to.be.true;
        });
      
        it("should not trigger the next middleware if the reaction does not match the emoji", async () => {
          const event = { reaction: ":emoji:" };
          const next = sinon.spy();
          const reactionMatchesMiddleware = reactionMatches(":not_emoji:");
          await reactionMatchesMiddleware({ event, next });
          expect(next.notCalled).to.be.true;
        });
    });
});
