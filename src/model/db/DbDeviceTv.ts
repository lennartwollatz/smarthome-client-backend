/** Zeile der Tabelle `device_tvs`. */
export class DbDeviceTv {
  readonly deviceId!: string;
  readonly isPowered!: boolean | null;
  readonly isScreenOn!: boolean | null;
  readonly volume!: number;
  readonly selectedChannel!: string | null;
  readonly selectedApp!: string | null;

  constructor(fields: DbDeviceTv) {
    Object.assign(this, fields);
  }
}
