/** Zeile der Tabelle `device_car_locations`. */
export class DbDeviceCarLocation {
  readonly deviceId!: string;
  readonly name!: string;
  readonly latitude!: number;
  readonly longitude!: number;

  constructor(fields: DbDeviceCarLocation) {
    Object.assign(this, fields);
  }
}
