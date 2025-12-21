import { App } from '@slack/bolt';
import { hasBeenPosted, markAsPosted } from './database';
import { getIncidentsForStation } from './national-rail';
import { getAllUserIds, getUserSettings } from './user-settings';

export function startPolling(app: App, nationalRailApiKey: string, nationalRailApiUrl: string): void {
  poll(app, nationalRailApiKey, nationalRailApiUrl);
  const pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS!, 10);
  setInterval(poll, pollIntervalMs, app, nationalRailApiKey, nationalRailApiUrl); 
}

async function poll(app: App, nationalRailApiKey: string, nationalRailApiUrl: string) {
  try {
    console.log('Polling for incidents...');
    
    // --- Single station polling for a predefined channel ---
    const globalStationCrs = process.env.STATION_CRS;
    const globalSlackChannelId = process.env.SLACK_CHANNEL_ID;
    
    if (globalStationCrs && globalSlackChannelId) {
      console.log(`Checking global station ${globalStationCrs}...`);
      const incidents = await getIncidentsForStation(
        globalStationCrs,
        nationalRailApiKey,
        nationalRailApiUrl
      );
      
      if (incidents.length > 0) {
        for (const incident of incidents) {
          if (!await hasBeenPosted(incident.url)) {
            await app.client.chat.postMessage({
              channel: globalSlackChannelId,
              text: `Incident at ${globalStationCrs}`,
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
      }
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
          
          if (incidents.length > 0) {
            for (const incident of incidents) {
              if (!await hasBeenPosted(incident.url)) { // Ensure not to re-post if already sent to global channel
                await app.client.chat.postMessage({
                  channel: userId,
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
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during polling:', error);
  }
}