/** Zeile der Tabelle `device_wac_details`. */
export class DbDeviceWacDetail {
  readonly deviceId!: string;
  readonly address!: string | null;
  readonly port!: number | null;

  constructor(fields: DbDeviceWacDetail) {
    Object.assign(this, fields);
  }
}
