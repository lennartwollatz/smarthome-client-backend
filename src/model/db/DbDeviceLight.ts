/** Zeile der Tabelle `device_lights`. */
export class DbDeviceLight {
  readonly deviceId!: string;
  readonly isOn!: boolean | null;
  readonly brightness!: number | null;
  readonly colorTemperature!: number | null;
  readonly colorX!: number | null;
  readonly colorY!: number | null;

  constructor(fields: DbDeviceLight) {
    Object.assign(this, fields);
  }
}
