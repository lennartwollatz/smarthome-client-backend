/** Zeile der Tabelle `device_heos_details`. */
export class DbDeviceHeosDetail {
  readonly deviceId!: string;
  readonly address!: string | null;
  readonly pid!: number | null;

  constructor(fields: DbDeviceHeosDetail) {
    Object.assign(this, fields);
  }
}
