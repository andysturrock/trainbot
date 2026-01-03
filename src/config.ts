import logger from './logger';

export interface Config {
  slackTeamId: string;
  slackChannelId: string;
  stationCrs: string;
  nationalRailApiUrl: string;
  pollIntervalMs: number;
  logLevel: string;
  gcpProjectId: string;
  secretName: string;
  nodeEnv: string;
  port: number;
}

function getEnv(name: string, required = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Environment variable ${name} is missing`);
  }
  return value || '';
}

function getIntEnv(name: string, required = true, defaultValue?: number): number {
  const value = getEnv(name, required);
  if (!value && defaultValue !== undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${value}`);
  }
  return parsed;
}

let config: Config | null = null;

export function getConfig(): Config {
  if (config) return config;

  try {
    const nodeEnv = process.env.NODE_ENV || 'development';

    config = {
      nodeEnv,
      slackTeamId: getEnv('SLACK_TEAM_ID'),
      slackChannelId: getEnv('SLACK_CHANNEL_ID'),
      stationCrs: getEnv('STATION_CRS'),
      nationalRailApiUrl: getEnv('NATIONAL_RAIL_API_URL'),
      pollIntervalMs: getIntEnv('POLL_INTERVAL_MS'),
      logLevel: process.env.LOG_LEVEL || 'info',
      gcpProjectId: getEnv('GCP_PROJECT_ID', nodeEnv === 'production'),
      secretName: getEnv('SECRET_NAME', nodeEnv === 'production'),
      port: getIntEnv('PORT', false, 3000),
    };

    return config;
  } catch (error) {
    logger.error('Configuration validation failed:', error);
    throw error;
  }
}

export function resetConfig(): void {
  config = null;
}
