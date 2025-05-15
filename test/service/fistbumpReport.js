const chai = require('chai');
const { expect } = chai;
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

// create mocks
const mockWinston = { info: sinon.stub(), error: sinon.stub(), debug: sinon.stub() };
const mockMoment = sinon.stub().returns({
  tz: sinon.stub().returns({
    format: sinon.stub().returns('May 15, 2025'),
    subtract: sinon.stub().returns({
      format: sinon.stub().returns('May 8, 2025'),
    }),
  }),
});

// mock recognition data
const mockRecognitionData = [
  { recognizee: 'U1234', recognizer: 'U5678', timestamp: new Date(), message: 'Great job!' },
  { recognizee: 'U1234', recognizer: 'U9876', timestamp: new Date(), message: 'Awesome work!' },
  { recognizee: 'U5432', recognizer: 'U1234', timestamp: new Date(), message: 'Thanks for the help!' },
];

// mock recognition service
const mockRecognition = {
  getPreviousXDaysOfRecognition: sinon.stub().resolves(mockRecognitionData),
  getCountOfRecognitionsInPreviousXDays: sinon.stub().resolves(3),
};

// create fistbumpReport with mocked dependencies
const fistbumpReport = proxyquire('../../service/fistbumpReport', {
  '../winston': mockWinston,
  'moment-timezone': mockMoment,
  './recognition': mockRecognition,
});

describe('fistbumpReport service', () => {
  beforeEach(() => {
    // reset all stubs
    sinon.reset();
  });

  describe('getFistbumpChartData', () => {
    it('should fetch recognition data and transform it for chart display', async () => {
      // arrange
      const timeRange = 7;
      const timezone = 'America/New_York';

      // act
      const result = await fistbumpReport.getFistbumpChartData(timeRange, timezone);

      // assert
      expect(mockRecognition.getPreviousXDaysOfRecognition.calledOnceWith(timezone, timeRange)).to.be.true;
      expect(result).to.have.property('type', 'bar');
      expect(result.data).to.have.property('labels').that.is.an('array');
      expect(result.data).to.have.property('datasets').that.is.an('array');
      expect(result.data.datasets[0]).to.have.property('data').that.is.an('array');
      expect(mockWinston.debug.calledOnce).to.be.true;
    });
  });

  describe('createFistbumpReportBlocks', () => {
    it('should create blocks for a Slack message with chart and stats', async () => {
      // arrange
      const timeRange = 7;
      const timezone = 'America/New_York';
      
      // mock chart data
      const mockChart = {
        type: 'bar',
        data: {
          labels: ['<@U1234>', '<@U5432>'],
          datasets: [{ label: 'Fistbumps Received', data: [2, 1] }],
        },
      };
      
      // stub the chart data function
      sinon.stub(fistbumpReport, 'getFistbumpChartData').resolves(mockChart);

      // act
      const blocks = await fistbumpReport.createFistbumpReportBlocks(timeRange, timezone);

      // assert
      expect(fistbumpReport.getFistbumpChartData.calledOnceWith(timeRange, timezone)).to.be.true;
      expect(blocks).to.be.an('array');
      expect(blocks.length).to.be.at.least(4); // should have header, context, image, and stats
      expect(blocks[0]).to.have.nested.property('text.text').that.includes('Report');
      expect(blocks.some(block => block.type === 'image')).to.be.true;
      expect(mockWinston.debug.calledOnce).to.be.true;
      
      // clean up
      fistbumpReport.getFistbumpChartData.restore();
    });
  });

  describe('postFistbumpReport', () => {
    it('should post report blocks to the specified channel', async () => {
      // arrange
      const mockClient = {
        chat: {
          postMessage: sinon.stub().resolves({ ok: true }),
        },
      };
      const channelId = 'C12345';
      const timeRange = 7;
      
      // stub the report blocks function
      const mockBlocks = [{ type: 'header', text: { type: 'plain_text', text: 'Test Report' } }];
      sinon.stub(fistbumpReport, 'createFistbumpReportBlocks').resolves(mockBlocks);

      // act
      const result = await fistbumpReport.postFistbumpReport(mockClient, channelId, timeRange);

      // assert
      expect(fistbumpReport.createFistbumpReportBlocks.calledOnceWith(timeRange)).to.be.true;
      expect(mockClient.chat.postMessage.calledOnce).to.be.true;
      expect(mockClient.chat.postMessage.firstCall.args[0]).to.have.property('channel', channelId);
      expect(mockClient.chat.postMessage.firstCall.args[0]).to.have.property('blocks', mockBlocks);
      expect(result).to.be.true;
      expect(mockWinston.info.calledOnce).to.be.true;
      
      // clean up
      fistbumpReport.createFistbumpReportBlocks.restore();
    });

    it('should handle errors when posting fails', async () => {
      // arrange
      const mockClient = {
        chat: {
          postMessage: sinon.stub().rejects(new Error('API error')),
        },
      };
      const channelId = 'C12345';
      const timeRange = 7;
      
      // stub the report blocks function
      sinon.stub(fistbumpReport, 'createFistbumpReportBlocks').resolves([]);

      // act
      const result = await fistbumpReport.postFistbumpReport(mockClient, channelId, timeRange);

      // assert
      expect(mockClient.chat.postMessage.calledOnce).to.be.true;
      expect(result).to.be.false;
      expect(mockWinston.error.calledOnce).to.be.true;
      
      // clean up
      fistbumpReport.createFistbumpReportBlocks.restore();
    });
  });
});
