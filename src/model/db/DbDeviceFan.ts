/** Zeile der Tabelle `device_fans`. */
export class DbDeviceFan {
  readonly deviceId!: string;
  readonly speed!: number | null;
  readonly isLightOn!: boolean | null;
  readonly lightBrightness!: number | null;

  constructor(fields: DbDeviceFan) {
    Object.assign(this, fields);
  }
}
