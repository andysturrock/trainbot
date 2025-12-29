
import { App } from '@slack/bolt';
import { hasBeenPosted, markAsPosted } from './database';
import { getIncidentsForStation } from './national-rail';
import { startPolling } from './polling';
import { getAllUserIds, getUserSettings } from './user-settings';

// Mock dependencies
jest.mock('./database');
jest.mock('./national-rail');
jest.mock('./user-settings');

// Mock Slack App
const mockPostMessage = jest.fn();
const mockApp = {
  client: {
    chat: {
      postMessage: mockPostMessage,
    },
  },
} as unknown as App;

const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

describe('polling', () => {
  const mockApiKey = 'key';
  const mockApiUrl = 'url';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env.POLL_INTERVAL_MS = '60000';
    (getAllUserIds as jest.Mock).mockResolvedValue([]);
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.STATION_CRS;
    delete process.env.SLACK_CHANNEL_ID;
    delete process.env.POLL_INTERVAL_MS;
    jest.restoreAllMocks();
  });

  it('should set up polling interval', () => {
    const spy = jest.spyOn(global, 'setInterval');
    startPolling(mockApp, mockApiKey, mockApiUrl);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 60000, mockApp, mockApiKey, mockApiUrl);
  });

  describe('Global Polling', () => {
    beforeEach(() => {
      process.env.STATION_CRS = 'WAT';
      process.env.SLACK_CHANNEL_ID = 'C123';
    });

    it('should post new incidents to global channel', async () => {
      (getIncidentsForStation as jest.Mock).mockResolvedValue([
        { title: 'Delay', summary: 'Broken train', url: 'http://incident/1' }
      ]);
      (hasBeenPosted as jest.Mock).mockResolvedValue(false);

      startPolling(mockApp, mockApiKey, mockApiUrl);

      // Wait for async operations to complete
      await flushPromises();

      expect(getIncidentsForStation).toHaveBeenCalledWith('WAT', mockApiKey, mockApiUrl);
      expect(hasBeenPosted).toHaveBeenCalledWith('http://incident/1');
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'C123',
        text: 'Incident at WAT'
      }));
      expect(markAsPosted).toHaveBeenCalledWith('http://incident/1');
    });

    it('should not post if already posted', async () => {
      (getIncidentsForStation as jest.Mock).mockResolvedValue([
        { title: 'Delay', summary: 'Broken train', url: 'http://incident/1' }
      ]);
      (hasBeenPosted as jest.Mock).mockResolvedValue(true);

      startPolling(mockApp, mockApiKey, mockApiUrl);
      await flushPromises();

      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(markAsPosted).not.toHaveBeenCalled();
    });
  });

  describe('User Polling', () => {
    beforeEach(() => {
      // Disable global
      delete process.env.STATION_CRS;
      delete process.env.SLACK_CHANNEL_ID;
    });

    it('should poll for each user', async () => {
      (getAllUserIds as jest.Mock).mockResolvedValue(['U1', 'U2']);
      (getUserSettings as jest.Mock).mockImplementation((userId: string) => {
        if (userId === 'U1') return Promise.resolve({ stations: ['ABC'] });
        if (userId === 'U2') return Promise.resolve({ stations: ['DEF'] });
        return Promise.resolve(undefined);
      });
      (getIncidentsForStation as jest.Mock).mockResolvedValue([
        { title: 'Delay', summary: 'Stuff', url: 'http://incident/2' }
      ]);
      (hasBeenPosted as jest.Mock).mockResolvedValue(false);

      startPolling(mockApp, mockApiKey, mockApiUrl);
      await flushPromises();
      await flushPromises(); // Sometimes needed for deeper chains

      // Check U1
      expect(getIncidentsForStation).toHaveBeenCalledWith('ABC', mockApiKey, mockApiUrl);
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'U1',
        text: 'Incident at ABC'
      }));

      // Check U2
      expect(getIncidentsForStation).toHaveBeenCalledWith('DEF', mockApiKey, mockApiUrl);
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'U2',
        text: 'Incident at DEF'
      }));
    });
  });
});
