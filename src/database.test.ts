
import { db, hasBeenPosted, markAsPosted } from './database';

// Define the mock structure inside the factory
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

describe('database', () => {
  let mockCollectionFn: any; // The collection function (spy)
  let mockCollection: any;   // The object returned by collection()
  let mockDocFn: any;        // The doc function (spy)
  let mockDoc: any;          // The object returned by doc()

  beforeAll(() => {
    // 'db' is the instance created by the constructor mock.
    // It has 'collection' method which is a jest function.
    const dbAny = db as any;
    mockCollectionFn = dbAny.collection;

    // Ensure db call was made (it happens at top level)
    if (mockCollectionFn.mock.calls.length === 0) {
      console.warn("db.collection was not called during init? It might be called lazily or 'posted-incidents' is done at top level.");
    }

    // Find the 'posted-incidents' call
    // const postedIncidentsCall = mockCollectionFn.mock.calls.find((args: any[]) => args[0] === 'posted-incidents');
    // Actually we can grab the result directly if we assume order or find via args.
    // For simplicity, let's look at results[0] and assume it is posted-incidents if only one call made so far,
    // or iterate.

    // Since database.ts makes ONE call, result[0] is it.
    const result = mockCollectionFn.mock.results[0];
    if (result) {
      mockCollection = result.value;
      mockDocFn = mockCollection.doc;
    } else {
      // Fallback if not initialized yet? It should be initiated on import.
    }
  });

  beforeEach(() => {
    // Create stable mock objects for assertion
    mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
    };

    if (mockDocFn) {
      mockDocFn.mockReset();
      mockDocFn.mockReturnValue(mockDoc);
    }

    jest.spyOn(console, 'log').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('hasBeenPosted', () => {
    it('should return true if document exists', async () => {
      mockDoc.get.mockResolvedValue({ exists: true });
      const result = await hasBeenPosted('http://example.com/incident');
      expect(result).toBe(true);
      expect(mockDocFn).toHaveBeenCalledWith(encodeURIComponent('http://example.com/incident'));
    });

    it('should return false if document does not exist', async () => {
      mockDoc.get.mockResolvedValue({ exists: false });
      const result = await hasBeenPosted('http://example.com/incident-new');
      expect(result).toBe(false);
    });
  });

  describe('markAsPosted', () => {
    it('should write to firestore with current timestamp', async () => {
      await markAsPosted('http://example.com/incident-posted');
      expect(mockDocFn).toHaveBeenCalledWith(encodeURIComponent('http://example.com/incident-posted'));
      expect(mockDoc.set).toHaveBeenCalledWith(expect.objectContaining({
        postedAt: expect.any(Date)
      }));
    });
  });
});
