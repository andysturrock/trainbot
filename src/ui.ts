import { HomeView } from '@slack/types';

export function getHomeView(stationsText: string): HomeView {
  return {
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
  };
}
