import { db } from './database';

export interface UserSettings {
  stations: string[];
}

const userSettingsCollection = db.collection('user-settings');

export async function saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  await userSettingsCollection.doc(userId).set(settings);
}

export async function getUserSettings(userId: string): Promise<UserSettings | undefined> {
  const doc = await userSettingsCollection.doc(userId).get();
  return doc.data() as UserSettings | undefined;
}

export async function getAllUserIds(): Promise<string[]> {
  const snapshot = await userSettingsCollection.get();
  return snapshot.docs.map(doc => doc.id);
}
