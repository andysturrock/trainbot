import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from './logger';

interface AppSecrets {
  slackSigningSecret: string;
  slackBotToken: string;
  nationalRailApiKey: string;
}

export async function getSecrets(): Promise<AppSecrets> {
  const secrets: Partial<AppSecrets> = {};

  if (process.env.NODE_ENV === 'production') {
    const client = new SecretManagerServiceClient();
    const name = `projects/${process.env.GCP_PROJECT_ID}/secrets/${process.env.SECRET_NAME}/versions/latest`;

    try {
      const [version] = await client.accessSecretVersion({ name });
      const payload = version.payload?.data?.toString();
      if (!payload) {
        throw new Error('Secret payload is empty');
      }
      const data = JSON.parse(payload);
      secrets.slackSigningSecret = data.SLACK_SIGNING_SECRET;
      secrets.slackBotToken = data.SLACK_BOT_TOKEN;
      secrets.nationalRailApiKey = data.NATIONAL_RAIL_API_KEY;
    } catch (error) {
      logger.error(`Error accessing Secret Manager [${name}]:`, error);
      throw error;
    }
  } else {
    secrets.slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    secrets.slackBotToken = process.env.SLACK_BOT_TOKEN;
    secrets.nationalRailApiKey = process.env.NATIONAL_RAIL_API_KEY;
  }

  // Strict validation
  const missing: string[] = [];
  if (!secrets.slackSigningSecret) missing.push('SLACK_SIGNING_SECRET');
  if (!secrets.slackBotToken) missing.push('SLACK_BOT_TOKEN');
  if (!secrets.nationalRailApiKey) missing.push('NATIONAL_RAIL_API_KEY');

  if (missing.length > 0) {
    throw new Error(`Critical secrets missing: ${missing.join(', ')}`);
  }

  return secrets as AppSecrets;
}
