/** Zeile der Tabelle `device_thermostats`. */
export class DbDeviceThermostat {
  readonly deviceId!: string;
  readonly temperatureGoal!: number;

  constructor(fields: DbDeviceThermostat) {
    Object.assign(this, fields);
  }
}
