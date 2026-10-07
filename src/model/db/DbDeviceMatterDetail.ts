/** Zeile der Tabelle `device_matter_details`. */
export class DbDeviceMatterDetail {
  readonly deviceId!: string;
  readonly nodeId!: string | null;

  constructor(fields: DbDeviceMatterDetail) {
    Object.assign(this, fields);
  }
}
