/** Zeile der Tabelle `device_lg_details`. */
export class DbDeviceLgDetail {
  readonly deviceId!: string;
  readonly address!: string | null;
  readonly clientKey!: string | null;
  readonly macAddress!: string | null;

  constructor(fields: DbDeviceLgDetail) {
    Object.assign(this, fields);
  }
}
