import { App, BlockAction, ExpressReceiver } from '@slack/bolt';
import * as dotenv from 'dotenv';
import { getConfig } from './config';
import logger from './logger';
import { startPolling } from './polling';
import { getSecrets } from './secrets';
import { fetchStations, filterStations } from './stations';
import { getUserSettings, saveUserSettings } from './user-settings';
import { getSlackContext } from './verification';

dotenv.config();

(async () => {
  const config = getConfig();
  const secrets = await getSecrets();

  // Debug logging for Slack configuration
  logger.info(`Slack configuration - Team ID: ${config.slackTeamId}, Enterprise ID: ${config.slackEnterpriseId || 'None'}, Channel ID: ${config.slackChannelId}, global station CRS: ${config.stationCrs}`);

  const receiver = new ExpressReceiver({
    signingSecret: secrets.slackSigningSecret,
  });

  // Direct express routes for GKE health checks
  receiver.app.get('/health', (_req, res) => {
    res.status(200).send('OK');
  });
  receiver.app.get('/', (_req, res) => {
    res.status(200).send('OK');
  });

  const app = new App({
    token: secrets.slackBotToken,
    receiver,
  });

  // Global middleware to verify workspace/enterprise
  app.use(async ({ body, next }) => {
    logger.debug(`Verifying request for team: ${(body as any).team_id || (body as any).team?.id}`);
    const { teamId, enterpriseId } = getSlackContext(body);

    const isAuthorizedTeam = config.slackTeamId && teamId === config.slackTeamId;
    const isAuthorizedEnterprise = config.slackEnterpriseId && enterpriseId === config.slackEnterpriseId;

    if (!isAuthorizedTeam && !isAuthorizedEnterprise) {
      logger.warn(`Rejected request from unauthorized source: Team=${teamId}, Enterprise=${enterpriseId}`);
      return; // Stop processing the request
    }

    await next();
  });

  app.use(async ({ body, next }) => {
    const bodyObj = body as Record<string, unknown>;
    const requestType = (bodyObj && typeof bodyObj === 'object' && 'type' in bodyObj) ? (bodyObj as { type: string }).type : 'unknown';
    logger.debug(`Received request: ${JSON.stringify({
      type: requestType,
      body: body
    })}`);
    await next();
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
    const selectedStations = selectedOptions?.map((option: { value: string }) => option.value) || [];

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
            {
              type: 'divider',
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'This application utilizes data provided by the Rail Delivery Group through the Rail Data Marketplace. All rights reserved by the respective data publishers and licensors.',
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
  await app.start(config.port);
  logger.info(`⚡️ Bolt app is running on port ${config.port}!`);
  startPolling(app, secrets.nationalRailApiKey);
})();


