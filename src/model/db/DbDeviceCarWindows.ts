/** Zeile der Tabelle `device_car_windows`. */
export class DbDeviceCarWindows {
  readonly deviceId!: string;
  readonly leftFront!: boolean;
  readonly leftRear!: boolean;
  readonly rightFront!: boolean;
  readonly rightRear!: boolean;
  readonly combinedState!: boolean;

  constructor(fields: DbDeviceCarWindows) {
    Object.assign(this, fields);
  }
}
