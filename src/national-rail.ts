import { XMLParser }from 'fast-xml-parser';
import { NationalRailIncident } from './types';
import { mockIncidentXml } from './mock-data';

export async function getIncidentsForStation(stationCrs: string, apiKey: string): Promise<NationalRailIncident[]> {
  try {
    // For now, we'll use the mock data.
    // In the future, we will make an API call here.
    const responseData = mockIncidentXml;

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const parsedData = parser.parse(responseData);

    const incidentData = parsedData['uk.co.nationalrail.xml.incident.PtIncidentStructure'];

    const incidents: NationalRailIncident[] = [
      {
        title: incidentData['ns3:Summary'],
        summary: incidentData['ns3:Description'].p,
        url: incidentData['ns3:InfoLinks']['ns3:InfoLink']['ns3:Uri'],
      },
    ];

    return incidents;
  } catch (error) {
    console.error('Error parsing incidents from National Rail API response:', error);
    return [];
  }
}
