/** Zeile der Tabelle `device_hue_details`. */
export class DbDeviceHueDetail {
  readonly deviceId!: string;
  readonly bridgeId!: string | null;
  readonly resourceId!: string | null;
  readonly batteryResourceId!: string | null;
  readonly motionResourceId!: string | null;
  readonly lightLevelResourceId!: string | null;
  readonly temperatureResourceId!: string | null;

  constructor(fields: DbDeviceHueDetail) {
    Object.assign(this, fields);
  }
}
