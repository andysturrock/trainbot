import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

interface AppSecrets {
  slackSigningSecret: string;
  slackBotToken: string;
  nationalRailApiKey: string;
}

export async function getSecrets(): Promise<AppSecrets> {
  if (process.env.NODE_ENV === 'production') {
    const client = new SecretManagerServiceClient();
    const name = `projects/${process.env.GCP_PROJECT_ID}/secrets/${process.env.SECRET_NAME}/versions/latest`;
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error('Secret payload is empty');
    }
    const secrets = JSON.parse(payload);
    return {
      slackSigningSecret: secrets.SLACK_SIGNING_SECRET,
      slackBotToken: secrets.SLACK_BOT_TOKEN,
      nationalRailApiKey: secrets.NATIONAL_RAIL_API_KEY,
    };
  } else {
    return {
      slackSigningSecret: process.env.SLACK_SIGNING_SECRET!,
      slackBotToken: process.env.SLACK_BOT_TOKEN!,
      nationalRailApiKey: process.env.NATIONAL_RAIL_API_KEY!,
    };
  }
}
