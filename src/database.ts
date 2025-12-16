import { Firestore } from '@google-cloud/firestore';

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
  console.log(`Connecting to Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
} else {
  // Connect to the live Firestore service
  db = new Firestore();
  console.log('Connecting to live Firestore service.');
}

export { db };


const postedIncidentsCollection = db.collection('posted-incidents');

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
