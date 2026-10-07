/** Zeile der Tabelle `device_temperature_readings`. */
export class DbDeviceTemperatureReading {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly recordedAt!: number;
  readonly temperature!: number;
  readonly temperatureGoal!: number;

  constructor(fields: DbDeviceTemperatureReading) {
    Object.assign(this, fields);
  }
}
