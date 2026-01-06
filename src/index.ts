import { App, BlockAction } from '@slack/bolt';
import * as dotenv from 'dotenv';
import logger from './logger';
import { startPolling } from './polling';
import { getSecrets } from './secrets';
import { fetchStations, filterStations } from './stations';
import { getUserSettings, saveUserSettings } from './user-settings';

dotenv.config();

(async () => {
  const secrets = await getSecrets();

  const app = new App({
    token: secrets.slackBotToken,
    signingSecret: secrets.slackSigningSecret,
    clientOptions: { teamId: secrets.slackTeamId }
  });

  app.event('app_home_opened', async ({ event, client }) => {
    try {
      const userSettings = await getUserSettings(event.user);
      const stationsText = userSettings?.stations.join(', ') || 'None';

      await client.views.publish({
        user_id: event.user,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Welcome to TrainBot!',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Your Stations:* ${stationsText}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Add/Edit Stations',
                  },
                  action_id: 'add_station_button',
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      logger.error(error);
    }
  });

  app.action('add_station_button', async ({ ack, body, client }) => {
    await ack();

    try {
      await client.views.open({
        trigger_id: (body as BlockAction).trigger_id,
        view: {
          type: 'modal',
          callback_id: 'station_selection_modal',
          title: {
            type: 'plain_text',
            text: 'Select Stations',
          },
          blocks: [
            {
              type: 'input',
              block_id: 'station_selection_block',
              label: {
                type: 'plain_text',
                text: 'Select the stations you want to monitor.',
              },
              element: {
                type: 'multi_external_select', // Changed to multi_external_select
                action_id: 'station_select_action',
                placeholder: {
                  type: 'plain_text',
                  text: 'Search for a station...',
                },
                min_query_length: 1,
              },
            },
          ],
          submit: {
            type: 'plain_text',
            text: 'Save',
          },
        },
      });
    } catch (error) {
      logger.error(error);
    }
  });

  // Handle options for the multi_external_select
  app.options('station_select_action', async ({ ack, payload }) => {
    try {
      const searchTerm = payload.value.toLowerCase();
      logger.debug(`Station search term: "${searchTerm}"`);
      const filtered = filterStations(searchTerm).map((station) => ({
        text: {
          type: 'plain_text' as const,
          text: `${station.name} (${station.crs})`,
        },
        value: station.crs,
      }));
      logger.debug(`Found ${filtered.length} stations.`);
      await ack({ options: filtered.slice(0, 100) }); // Slack limits to 100 options
    } catch (error) {
      logger.error('Error in station_select_action options handler: ', error);
      await ack({ options: [] });
    }
  });

  app.view('station_selection_modal', async ({ ack, body, view, client }) => {
    await ack();

    const selectedOptions = view.state.values.station_selection_block.station_select_action.selected_options;
    const selectedStations = selectedOptions?.map((option: any) => option.value) || [];

    await saveUserSettings(body.user.id, { stations: selectedStations });

    // Update the app home view
    const userSettings = await getUserSettings(body.user.id);
    const stationsText = userSettings?.stations.join(', ') || 'None';

    try {
      await client.views.publish({
        user_id: body.user.id,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Welcome to TrainBot!',
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Your Stations:* ${stationsText}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Add/Edit Stations',
                  },
                  action_id: 'add_station_button',
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      logger.error(error);
    }
  });

  await fetchStations();
  const port = process.env.PORT || 3000;
  await app.start(port);
  logger.info(`⚡️ Bolt app is running on port ${port}!`);
  startPolling(app, secrets.nationalRailApiKey, secrets.nationalRailApiUrl);
})();


