/** Zeile der Tabelle `device_xiaomi_details`. */
export class DbDeviceXiaomiDetail {
  readonly deviceId!: string;
  readonly address!: string | null;
  readonly token!: string | null;
  readonly model!: string | null;
  readonly did!: string | null;

  constructor(fields: DbDeviceXiaomiDetail) {
    Object.assign(this, fields);
  }
}
