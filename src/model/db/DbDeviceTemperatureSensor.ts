/** Zeile der Tabelle `device_temperature_sensors`. */
export class DbDeviceTemperatureSensor {
  readonly deviceId!: string;
  readonly temperature!: number | null;

  constructor(fields: DbDeviceTemperatureSensor) {
    Object.assign(this, fields);
  }
}
