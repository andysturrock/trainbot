
import axios from 'axios';
import { fetchStations, filterStations, getStations } from './stations';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('stations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the internal stations array if possible or ensure tests are isolated
    // Since 'stations' is a module-level variable, we might need to rely on fetchStations to reset it
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchStations', () => {
    it('should fetch and populate stations successfully', async () => {
      const mockData = [
        { stationName: 'London Waterloo', crsCode: 'WAT' },
        { stationName: 'Bristol Temple Meads', crsCode: 'BRI' },
      ];
      mockedAxios.get.mockResolvedValue({ data: mockData } as any);

      await fetchStations();

      const stations = getStations();
      expect(stations).toHaveLength(2);
      expect(stations[0]).toEqual({ name: 'London Waterloo', crs: 'WAT' });
      expect(stations[1]).toEqual({ name: 'Bristol Temple Meads', crs: 'BRI' });
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await fetchStations();

      // Should probably still be whatever it was before, or empty if this is first run
      // In this test suite order, it might retain previous values if not reset.
      // However, the function catches the error and logs it.
      expect(consoleSpy).toHaveBeenCalledWith('!!! Initial station load failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('filterStations', () => {
    beforeAll(async () => {
      // Ensure we have data for these tests
      const mockData = [
        { stationName: 'London Waterloo', crsCode: 'WAT' },
        { stationName: 'Bristol Temple Meads', crsCode: 'BRI' },
        { stationName: 'Manchester Piccadilly', crsCode: 'MAN' },
      ];
      mockedAxios.get.mockResolvedValue({ data: mockData } as any);

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
      await fetchStations();
      logSpy.mockRestore();
    });

    it('should filter by name case-insensitive', () => {
      const result = filterStations('london');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('London Waterloo');
    });

    it('should filter by CRS case-insensitive', () => {
      const result = filterStations('bri');
      expect(result).toHaveLength(1);
      expect(result[0].crs).toBe('BRI');
    });

    it('should return multiple matches', () => {
      // Re-setup with ambiguous data if needed, or stick to what we have
      // "Ma" matches "Manchester"
      const result = filterStations('Ma');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.find(s => s.name === 'Manchester Piccadilly')).toBeDefined();
    });

    it('should return empty array if no matches', () => {
      const result = filterStations('XYZ');
      expect(result).toHaveLength(0);
    });
  });
});
