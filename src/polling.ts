import { App } from '@slack/bolt';
import { getAllUserIds, getUserSettings } from './user-settings';
import { getIncidentsForStation } from './national-rail';
import { hasBeenPosted, markAsPosted } from './database';

export function startPolling(app: App, nationalRailApiKey: string): void {
  setInterval(async () => {
    console.log('Polling for incidents...');

    // --- Single station polling for a predefined channel ---
    const globalStationCrs = process.env.STATION_CRS;
    const globalSlackChannel = process.env.SLACK_CHANNEL;

    if (globalStationCrs && globalSlackChannel) {
      console.log(`Checking global station ${globalStationCrs}...`);
      const incidents = await getIncidentsForStation(
        globalStationCrs,
        nationalRailApiKey
      );

      if (incidents.length > 0) {
        for (const incident of incidents) {
          if (!await hasBeenPosted(incident.url)) {
            await app.client.chat.postMessage({
              channel: globalSlackChannel,
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
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: 'View on National Rail',
                      },
                      url: incident.url,
                    },
                  ],
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
            nationalRailApiKey
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
                      type: 'actions',
                      elements: [
                        {
                          type: 'button',
                          text: {
                            type: 'plain_text',
                            text: 'View on National Rail',
                          },
                          url: incident.url,
                        },
                      ],
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
  }, 60000); // Poll every 60 seconds
}
