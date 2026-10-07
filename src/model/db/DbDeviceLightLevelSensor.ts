/** Zeile der Tabelle `device_light_level_sensors`. */
export class DbDeviceLightLevelSensor {
  readonly deviceId!: string;
  readonly lightLevel!: number | null;

  constructor(fields: DbDeviceLightLevelSensor) {
    Object.assign(this, fields);
  }
}
