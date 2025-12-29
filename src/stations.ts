import axios from 'axios';
import logger from './logger';

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
    logger.info('Fetching stations...');
    const response = await axios.get<FetchedStation[]>('https://raw.githubusercontent.com/davwheat/uk-railway-stations/main/stations.json');
    stations = response.data.map(station => ({
      name: station.stationName,
      crs: station.crsCode,
    }));
    logger.info(`Loaded ${stations.length} stations.`);
  } catch (error) {
    logger.error('Initial station load failed:', error);
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
