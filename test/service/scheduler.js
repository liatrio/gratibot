const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

// create mocks
const mockScheduleJob = sinon.stub();
const mockSchedule = { scheduleJob: mockScheduleJob };
const mockWinston = { info: sinon.stub(), error: sinon.stub(), debug: sinon.stub() };

// mock job with cancel method
const mockJob = { cancel: sinon.stub().returns(true) };

// create scheduler with mocked dependencies
const scheduler = proxyquire('../../service/scheduler', {
  'node-schedule': mockSchedule,
  '../winston': mockWinston,
});

describe('scheduler service', () => {
  beforeEach(() => {
    // reset all stubs
    sinon.reset();
    mockScheduleJob.returns(mockJob);
  });

  it('should schedule a job with the provided cron expression', () => {
    // arrange
    const jobName = 'test-job';
    const cronExpression = '0 9 * * 1';
    const jobFunction = () => {};

    // act
    const result = scheduler.scheduleJob(jobName, cronExpression, jobFunction);

    // assert
    expect(mockScheduleJob.calledOnce).to.be.true;
    expect(mockScheduleJob.firstCall.args[0]).to.equal(jobName);
    expect(mockScheduleJob.firstCall.args[1]).to.equal(cronExpression);
    expect(mockScheduleJob.firstCall.args[2]).to.equal(jobFunction);
    expect(result).to.equal(mockJob);
  });

  it('should cancel an existing job when scheduling with the same name', () => {
    // arrange
    const jobName = 'test-job';
    
    // act - schedule job twice with the same name
    scheduler.scheduleJob(jobName, '0 9 * * 1', () => {});
    scheduler.scheduleJob(jobName, '0 12 * * 1', () => {});

    // assert
    expect(mockJob.cancel.calledOnce).to.be.true;
    expect(mockScheduleJob.calledTwice).to.be.true;
  });

  it('should cancel a job by name', () => {
    // arrange
    const jobName = 'test-job';
    scheduler.scheduleJob(jobName, '0 9 * * 1', () => {});
    sinon.reset(); // reset call counts

    // act
    const result = scheduler.cancelJob(jobName);

    // assert
    expect(mockJob.cancel.calledOnce).to.be.true;
    expect(result).to.be.true;
  });

  it('should return false when canceling a non-existent job', () => {
    // act
    const result = scheduler.cancelJob('non-existent-job');

    // assert
    expect(mockJob.cancel.called).to.be.false;
    expect(result).to.be.false;
  });
});
