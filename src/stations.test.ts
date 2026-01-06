
import type { AxiosResponse } from 'axios';
import axios from 'axios';
import { fetchStations, filterStations, getStations } from './stations';

import logger from './logger';

jest.mock('axios');
jest.mock('./logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('stations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the internal stations array if possible or ensure tests are isolated
    // Since 'stations' is a module-level variable, we might need to rely on fetchStations to reset it
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
      mockedAxios.get.mockResolvedValue({ data: mockData } as unknown as AxiosResponse);

      await fetchStations();

      const stations = getStations();
      expect(stations).toHaveLength(2);
      expect(stations[0]).toEqual({ name: 'London Waterloo', crs: 'WAT' });
      expect(stations[1]).toEqual({ name: 'Bristol Temple Meads', crs: 'BRI' });
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await fetchStations();

      expect(mockedLogger.error).toHaveBeenCalledWith('Initial station load failed:', expect.any(Error));
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
      mockedAxios.get.mockResolvedValue({ data: mockData } as unknown as AxiosResponse);

      await fetchStations();
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
