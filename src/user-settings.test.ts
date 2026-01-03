
import { db } from './database'; // Import db to access the mock
import { getAllUserIds, getUserSettings, saveUserSettings } from './user-settings';

jest.mock('@google-cloud/firestore', () => {
  return {
    Firestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(),
          set: jest.fn(),
        })),
        get: jest.fn(),
      })),
      settings: jest.fn(),
    }))
  };
});

describe('user-settings', () => {
  let mockCollectionFn: jest.Mock;
  let mockCollection: { doc: jest.Mock; get: jest.Mock };
  let mockDocFn: jest.Mock;
  let mockDoc: { get: jest.Mock; set: jest.Mock };

  beforeAll(() => {
    const dbAny = db as unknown as { collection: jest.Mock };
    mockCollectionFn = dbAny.collection;

    // Identify 'user-settings' collection call
    const calls = mockCollectionFn.mock.calls;
    const index = calls.findIndex((args: unknown[]) => (args as string[])[0] === 'user-settings');

    if (index !== -1) {
      mockCollection = mockCollectionFn.mock.results[index].value;
      mockDocFn = mockCollection.doc;
    }
  });

  beforeEach(() => {
    mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
    };
    if (mockDocFn) {
      mockDocFn.mockReset();
      mockDocFn.mockReturnValue(mockDoc);
    }

    if (mockCollection) {
      mockCollection.get.mockReset();
    }
    jest.spyOn(console, 'log').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveUserSettings', () => {
    it('should save settings for a user', async () => {
      const userId = 'U123';
      const settings = { stations: ['ABC', 'DEF'] };

      await saveUserSettings(userId, settings);

      expect(mockDocFn).toHaveBeenCalledWith(userId);
      expect(mockDoc.set).toHaveBeenCalledWith(settings);
    });
  });

  describe('getUserSettings', () => {
    it('should return settings if they exist', async () => {
      const userId = 'U123';
      const settings = { stations: ['ABC'] };
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => settings
      });

      const result = await getUserSettings(userId);
      expect(result).toEqual(settings);
    });

    it('should return undefined if they do not exist', async () => {
      const userId = 'U404';
      mockDoc.get.mockResolvedValue({
        exists: false,
        data: () => undefined
      });

      const result = await getUserSettings(userId);
      expect(result).toBeUndefined();
    });
  });

  describe('getAllUserIds', () => {
    it('should return a list of all user IDs', async () => {
      const mockDocs = [
        { id: 'U1' },
        { id: 'U2' },
      ];
      // This uses collection.get()
      mockCollection.get.mockResolvedValue({
        docs: mockDocs
      });

      const result = await getAllUserIds();
      expect(result).toEqual(['U1', 'U2']);
    });
  });
});
