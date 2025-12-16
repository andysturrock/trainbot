import axios from 'axios';

export interface Station {
  stationName: string;
  crsCode: string;
}

// Interface for the raw data from the API
interface RawStation {
  stationName: string;
  crsCode: string;
  // Other fields from the API can be added here if needed,
  // but are not required for our use case.
}

let stations: Station[] = [];

export async function fetchStations(): Promise<void> {
  try {
    const response = await axios.get<RawStation[]>('https://raw.githubusercontent.com/davwheat/uk-railway-stations/main/stations.json');
    stations = response.data.map(station => ({
      stationName: station.stationName,
      crsCode: station.crsCode,
    }));
  } catch (error) {
    console.error('Error fetching stations:', error);
  }
}

export function getStations(): Station[] {
  return stations;
}
