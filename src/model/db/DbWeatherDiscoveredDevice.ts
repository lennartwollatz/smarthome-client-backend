/** Zeile der Tabelle `weather_discovered_devices`. */
export class DbWeatherDiscoveredDevice {
  readonly id!: string;
  readonly name!: string | null;
  readonly address!: string | null;
  readonly port!: number | null;
  readonly latitude!: number | null;
  readonly longitude!: number | null;

  constructor(fields: DbWeatherDiscoveredDevice) {
    Object.assign(this, fields);
  }
}
