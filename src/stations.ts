import axios from 'axios';

export interface Station {
  name: string;
  crs: string;
}

let stations: Station[] = [];

interface FetchedStation {
  stationName: string;
  crsCode: string;
}

export async function fetchStations(): Promise<void> {
  try {
    console.log('Fetching stations...');
    const response = await axios.get<FetchedStation[]>('https://raw.githubusercontent.com/davwheat/uk-railway-stations/main/stations.json');
    stations = response.data.map(station => ({
      name: station.stationName,
      crs: station.crsCode,
    }));
    console.log(`Loaded ${stations.length} stations.`);
  } catch (error) {
    console.error('!!! Initial station load failed:', error);
  }
}

export function getStations(): Station[] {
  return stations;
}

export function filterStations(searchTerm: string): Station[] {
  const lowerCaseSearchTerm = searchTerm.toLowerCase();
  return stations.filter(
    (station) =>
      station.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      station.crs.toLowerCase().includes(lowerCaseSearchTerm)
  );
}
