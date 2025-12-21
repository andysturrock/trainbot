import { XMLParser } from 'fast-xml-parser';
import { NationalRailIncident } from './types';
import { getStations } from './stations';

export async function getIncidentsForStation(stationCrs: string, apiKey: string, nationalRailApiUrl: string): Promise<NationalRailIncident[]> {
  try {
    const stations = getStations();
    const station = stations.find(s => s.crs === stationCrs);

    if (!station) {
      console.warn(`Station with CRS code ${stationCrs} not found.`);
      return [];
    }

    const stationNameSlug = station.name.toLowerCase().replace(/ /g, '-');
    const stationName = station.name.toLowerCase();
    console.log(`Filtering incidents for station: ${station.name} (slug: ${stationNameSlug})`);

    const response = await fetch(nationalRailApiUrl, {
      headers: {
        'x-apikey': apiKey,
      },
    });
    const responseData = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const parsedData = parser.parse(responseData);

    const allIncidents: NationalRailIncident[] = [];
    const tocs = parsedData.NSI.TOC;

    for (const toc of tocs) {
      if (toc.Status !== 'Good service') {
        if (toc.ServiceGroup) {
          const serviceGroups = Array.isArray(toc.ServiceGroup) ? toc.ServiceGroup : [toc.ServiceGroup];
          for (const group of serviceGroups) {
            if (group.CustomURL) {
              const title =
                toc.Status === 'Custom'
                  ? toc.TocName
                  : `${toc.TocName}: ${toc.Status}`;

              allIncidents.push({
                title,
                summary: toc.StatusDescription,
                url: group.CustomURL,
              });
            }
          }
        }
      }
    }

    console.log(`Found ${allIncidents.length} total incidents before filtering.`);

    const filteredIncidents = allIncidents.filter(incident => {
      const url = incident.url.toLowerCase();
      const summary = incident.summary.toLowerCase();

      return url.includes(stationNameSlug) || summary.includes(stationName);
    });

    console.log(`Found ${filteredIncidents.length} incidents for ${station.name}.`);

    return filteredIncidents;
  } catch (error) {
    console.error('Error parsing incidents from National Rail API response:', error);
    return [];
  }
}
