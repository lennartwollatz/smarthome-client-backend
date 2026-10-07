/** Zeile der Tabelle `device_car_doors`. */
export class DbDeviceCarDoors {
  readonly deviceId!: string;
  readonly combinedSecurityState!: boolean;
  readonly leftFront!: boolean;
  readonly leftRear!: boolean;
  readonly rightFront!: boolean;
  readonly rightRear!: boolean;
  readonly combinedState!: boolean;
  readonly hood!: boolean;
  readonly trunk!: boolean;

  constructor(fields: DbDeviceCarDoors) {
    Object.assign(this, fields);
  }
}
