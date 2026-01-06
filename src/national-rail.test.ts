
import { getIncidentsForStation } from './national-rail';
import { getStations } from './stations';

// Mock the stations module
jest.mock('./stations');
const mockedGetStations = getStations as jest.MockedFunction<typeof getStations>;

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

describe('getIncidentsForStation', () => {
  const mockApiKey = 'test-api-key';
  const mockApiUrl = 'https://api.nationalrail.co.uk/incidents';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return empty array if station not found', async () => {
    mockedGetStations.mockReturnValue([]);
    const result = await getIncidentsForStation('XYZ', mockApiKey, mockApiUrl);
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should fetch and parse incidents correctly', async () => {
    mockedGetStations.mockReturnValue([
      { name: 'Test Station', crs: 'TST' }
    ]);

    const mockXmlResponse = `
      <NSI>
        <TOC>
          <TocName>Test Operator</TocName>
          <Status>Service Disruption</Status>
          <StatusDescription>Delays expected</StatusDescription>
          <ServiceGroup>
            <CustomURL>http://example.com/incident-tst</CustomURL>
          </ServiceGroup>
        </TOC>
      </NSI>
    `;

    (global.fetch as jest.Mock).mockResolvedValue({
      text: jest.fn().mockResolvedValue(mockXmlResponse),
    });

    const result = await getIncidentsForStation('TST', mockApiKey, mockApiUrl);

    expect(fetch).toHaveBeenCalledWith(mockApiUrl, {
      headers: { 'x-apikey': mockApiKey },
    });

    // The slug for 'Test Station' is 'test-station'
    // The CustomURL 'http://example.com/incident-tst' does NOT contain 'test-station'
    // But verify the filtering logic:
    // url.includes(stationNameSlug) || summary.includes(stationName)
    // slug = 'test-station', stationName = 'test station'
    // URL doesn't match. Summary 'Delays expected' doesn't match.
    // So it should return empty if I stick to the logic strictly.

    // Let's adjust the mock to match
    const mockXmlResponseMatching = `
      <NSI>
        <TOC>
          <TocName>Test Operator</TocName>
          <Status>Service Disruption</Status>
          <StatusDescription>Delays expected at Test Station</StatusDescription>
          <ServiceGroup>
            <CustomURL>http://example.com/incident-test-station</CustomURL>
          </ServiceGroup>
        </TOC>
      </NSI>
    `;
    (global.fetch as jest.Mock).mockResolvedValue({
      text: jest.fn().mockResolvedValue(mockXmlResponseMatching),
    });

    const result2 = await getIncidentsForStation('TST', mockApiKey, mockApiUrl);

    expect(result2).toHaveLength(1);
    expect(result2[0]).toEqual({
      title: 'Test Operator: Service Disruption',
      summary: 'Delays expected at Test Station',
      url: 'http://example.com/incident-test-station',
    });
  });

  it('should handle API errors gracefully', async () => {
    mockedGetStations.mockReturnValue([
      { name: 'Test Station', crs: 'TST' }
    ]);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    const result = await getIncidentsForStation('TST', mockApiKey, mockApiUrl);
    expect(result).toEqual([]);
  });
});
