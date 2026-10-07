/** Zeile der Tabelle `device_cars`. */
export class DbDeviceCar {
  readonly deviceId!: string;
  readonly vin!: string | null;
  readonly fuelLevelPercent!: number | null;
  readonly rangeKm!: number | null;
  readonly mileageKm!: number | null;
  readonly isLocked!: boolean | null;
  readonly isInUse!: boolean | null;
  readonly isClimateControlOn!: boolean | null;

  constructor(fields: DbDeviceCar) {
    Object.assign(this, fields);
  }
}
