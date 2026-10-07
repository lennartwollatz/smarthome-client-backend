/** Zeile der Tabelle `device_motion_sensors`. */
export class DbDeviceMotionSensor {
  readonly deviceId!: string;
  readonly sensitivity!: number | null;
  readonly isMotion!: boolean | null;
  readonly motionLastDetected!: string | null;

  constructor(fields: DbDeviceMotionSensor) {
    Object.assign(this, fields);
  }
}
