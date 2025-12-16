import { App, BlockAction } from '@slack/bolt';
import * as dotenv from 'dotenv';
import { getIncidentsForStation } from './national-rail';
import { fetchStations, getStations } from './stations';
import { getUserSettings, saveUserSettings } from './user-settings';
import { startPolling } from './polling';
import { getSecrets } from './secrets';

dotenv.config();

(async () => {
  const secrets = await getSecrets();

  const app = new App({
    token: secrets.slackBotToken,
    signingSecret: secrets.slackSigningSecret,
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
      console.error(error);
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
                type: 'multi_static_select',
                action_id: 'station_select_action',
                options: getStations().map((station) => ({
                  text: {
                    type: 'plain_text',
                    text: `${station.stationName} (${station.crsCode})`,
                  },
                  value: station.crsCode,
                })),
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
      console.error(error);
    }
  });

  app.view('station_selection_modal', async ({ ack, body, view }) => {
    await ack();

    const selectedOptions = view.state.values.station_selection_block.station_select_action.selected_options;
    const selectedStations = selectedOptions?.map((option: any) => option.value) || [];

    await saveUserSettings(body.user.id, { stations: selectedStations });
  });

  await fetchStations();
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Bolt app is running on port ${port}!`);
  startPolling(app, secrets.nationalRailApiKey);
})();
