/** Zeile der Tabelle `device_energy_readings`. */
export class DbDeviceEnergyReading {
  readonly deviceId!: string;
  readonly sortIndex!: number;
  readonly recordedAt!: number;
  readonly usageValue!: number;

  constructor(fields: DbDeviceEnergyReading) {
    Object.assign(this, fields);
  }
}
