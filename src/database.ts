import { Firestore } from '@google-cloud/firestore';
import logger from './logger';

let db: Firestore;

if (process.env.FIRESTORE_EMULATOR_HOST) {
  // Connect to the local emulator
  db = new Firestore({
    host: process.env.FIRESTORE_EMULATOR_HOST,
    projectId: process.env.GCP_PROJECT_ID,
    // The emulator does not require credentials
    credentials: {
      client_email: 'test@example.com',
      private_key: 'test_key',
    },
  });
  logger.info(`Connecting to Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
} else {
  // Connect to the live Firestore service
  logger.info(`FIRESTORE_DATABASE_ID: "${process.env.FIRESTORE_DATABASE_ID}"`);
  logger.info(`GCP_PROJECT_ID: "${process.env.GCP_PROJECT_ID}"`);
  const config = {
    databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    projectId: process.env.GCP_PROJECT_ID,
  };
  logger.info(`Firestore config: ${JSON.stringify(config)}`);
  db = new Firestore(config);
  if (process.env.NODE_ENV !== 'test') {
    logger.info(`Connecting to live Firestore service. Project: ${config.projectId}, Database: ${config.databaseId}`);
  }
}

export { db };


const postedIncidentsCollection = db.collection('posted-incidents');
const stationStatusCollection = db.collection('station-status');

export async function hasBeenPosted(incidentUrl: string): Promise<boolean> {
  const docId = encodeURIComponent(incidentUrl);
  const doc = await postedIncidentsCollection.doc(docId).get();
  return doc.exists;
}

export async function markAsPosted(incidentUrl: string): Promise<void> {
  const docId = encodeURIComponent(incidentUrl);
  await postedIncidentsCollection.doc(docId).set({
    postedAt: new Date(),
  });
}

export async function hasGoodServiceBeenPosted(channelId: string, stationCrs: string): Promise<boolean> {
  const docId = `${channelId}-${stationCrs}`;
  const doc = await stationStatusCollection.doc(docId).get();
  return doc.exists && doc.data()?.status === 'good';
}

export async function markGoodServiceAsPosted(channelId: string, stationCrs: string): Promise<void> {
  const docId = `${channelId}-${stationCrs}`;
  await stationStatusCollection.doc(docId).set({
    status: 'good',
    postedAt: new Date(),
  });
}

export async function clearGoodServicePosted(channelId: string, stationCrs: string): Promise<void> {
  const docId = `${channelId}-${stationCrs}`;
  await stationStatusCollection.doc(docId).delete();
}
