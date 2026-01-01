import { App } from '@slack/bolt';
import { clearGoodServicePosted, hasBeenPosted, hasGoodServiceBeenPosted, markAsPosted, markGoodServiceAsPosted } from './database';
import logger from './logger';
import { getIncidentsForStation } from './national-rail';
import { NationalRailIncident } from './types';
import { getAllUserIds, getUserSettings } from './user-settings';

export function startPolling(app: App, nationalRailApiKey: string, nationalRailApiUrl: string): void {
  poll(app, nationalRailApiKey, nationalRailApiUrl);
  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS!, 10);
  setInterval(poll, pollIntervalMs, app, nationalRailApiKey, nationalRailApiUrl);
}

async function poll(app: App, nationalRailApiKey: string, nationalRailApiUrl: string) {
  if (!nationalRailApiUrl) {
    logger.error('NATIONAL_RAIL_API_URL is missing from environment variables.');
    return;
  }
  try {
    logger.debug('Polling for incidents...');

    // --- Single station polling for a predefined channel ---
    const globalStationCrs = process.env.STATION_CRS;
    const globalSlackChannelId = process.env.SLACK_CHANNEL_ID;

    if (globalStationCrs && globalSlackChannelId) {
      const incidents = await getIncidentsForStation(
        globalStationCrs,
        nationalRailApiKey,
        nationalRailApiUrl
      );
      await processStationStatus(app, globalSlackChannelId, globalStationCrs, incidents);
    }

    // --- Per-user station polling ---
    const userIds = await getAllUserIds();

    for (const userId of userIds) {
      const userSettings = await getUserSettings(userId);
      if (userSettings) {
        for (const stationCrs of userSettings.stations) {
          const incidents = await getIncidentsForStation(
            stationCrs,
            nationalRailApiKey,
            nationalRailApiUrl
          );
          await processStationStatus(app, userId, stationCrs, incidents);
        }
      }
    }
  } catch (error) {
    logger.error('Error during polling:', error);
  }
}

async function processStationStatus(app: App, channelId: string, stationCrs: string, incidents: NationalRailIncident[]) {
  if (incidents.length > 0) {
    // There are incidents
    for (const incident of incidents) {
      if (!await hasBeenPosted(incident.url)) {
        await app.client.chat.postMessage({
          channel: channelId,
          text: `Incident at ${stationCrs}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${incident.title}*`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: incident.summary,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `<${incident.url}|View on National Rail>`,
              },
            },
          ],
        });
        await markAsPosted(incident.url);
      }
    }
    // Clear the "Good Service" flag so it can be re-posted when cleared
    await clearGoodServicePosted(channelId, stationCrs);
  } else {
    // No incidents - check if we should post "Good Service"
    if (!await hasGoodServiceBeenPosted(channelId, stationCrs)) {
      await app.client.chat.postMessage({
        channel: channelId,
        text: `✅ *Good service at ${stationCrs}* (All previous incidents cleared)`,
      });
      await markGoodServiceAsPosted(channelId, stationCrs);
      logger.debug(`Posted Good Service for ${stationCrs} in ${channelId}`);
    }
  }
}