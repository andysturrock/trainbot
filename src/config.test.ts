import { getConfig, resetConfig } from './config';

jest.mock('./logger');

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    resetConfig();

    // Set required variables for minimal valid config
    process.env.SLACK_TEAM_ID = 'T123';
    process.env.SLACK_CHANNEL_ID = 'C123';
    process.env.STATION_CRS = 'NCL';
    process.env.NATIONAL_RAIL_API_URL = 'http://api';
    process.env.POLL_INTERVAL_MS = '300000';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return valid config when all required env vars are set', () => {
    const config = getConfig();
    expect(config.slackTeamId).toBe('T123');
    expect(config.slackChannelId).toBe('C123');
    expect(config.stationCrs).toBe('NCL');
    expect(config.nationalRailApiUrl).toBe('http://api');
    expect(config.pollIntervalMs).toBe(300000);
    expect(config.port).toBe(3000); // Default
    expect(config.logLevel).toBe('info'); // Default
  });

  it('should throw error if a required env var is missing', () => {
    delete process.env.SLACK_TEAM_ID;
    expect(() => getConfig()).toThrow('Environment variable SLACK_TEAM_ID is missing');
  });

  it('should throw error if POLL_INTERVAL_MS is not a number', () => {
    process.env.POLL_INTERVAL_MS = 'not-a-number';
    expect(() => getConfig()).toThrow('Environment variable POLL_INTERVAL_MS must be a number, got: not-a-number');
  });

  it('should use custom port if provided', () => {
    process.env.PORT = '4000';
    const config = getConfig();
    expect(config.port).toBe(4000);
  });

  it('should require GCP_PROJECT_ID in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => getConfig()).toThrow('Environment variable GCP_PROJECT_ID is missing');

    process.env.GCP_PROJECT_ID = 'my-project';
    process.env.SECRET_NAME = 'my-secret';
    const config = getConfig();
    expect(config.gcpProjectId).toBe('my-project');
  });

  it('should cache config after first call', () => {
    const config1 = getConfig();
    process.env.SLACK_TEAM_ID = 'OTHER';
    const config2 = getConfig();
    expect(config2.slackTeamId).toBe('T123');
    expect(config1).toBe(config2);
  });
});
